import hashlib
import json
import re
from decimal import ROUND_HALF_UP, Decimal
from django.conf import settings
from django.db import transaction
from django.db.models import Q, F, Value
from django.db.models.functions import Replace
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import serializers
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from .security import reject_markup
from .models import Order, OrderItem, Product, User, StatusHistory, Problem
from .serializers import CheckoutSerializer, CustomerOrderSerializer, OrderSerializer
from .security import lock_active_actor

# The portals poll this list every few seconds, so every response is bounded. Older orders stay reachable through filters.
DEFAULT_ORDER_LIST_LIMIT = 100
MAX_ORDER_LIST_LIMIT = 500

class Conflict(APIException):
    status_code = 409
    default_detail = 'Данные изменились. Обновите страницу и подтвердите действие ещё раз.'

def scoped_orders(user):
    orders = Order.objects.select_related('courier', 'payment').prefetch_related('items', 'status_history', 'problems')
    if user.role in ('ADMIN', 'CASHIER'):
        return orders
    if user.role == 'COURIER':
        return orders.filter(courier=user)
    return orders.filter(customer=user)

def locked_order(user, pk):
    # Lock only the order: courier is nullable and PostgreSQL cannot lock an outer join.
    return get_object_or_404(scoped_orders(user).select_for_update(of=('self',)), pk=pk)

def order_serializer_for(user):
    # Customers get the customer view; staff roles keep the full view with actor names.
    return CustomerOrderSerializer if user.role == 'CUSTOMER' else OrderSerializer

def order_response(order, user, status=200):
    # Mutations may have populated prefetch caches before adding a history/problem row.
    order = Order.objects.select_related('courier', 'payment').prefetch_related('items', 'status_history', 'problems').get(pk=order.pk)
    return Response(order_serializer_for(user)(order).data, status=status)

class Orders(APIView):
    def get(self, request):
        orders = scoped_orders(request.user)
        status = request.query_params.get('status')
        if status:
            if status not in Order.Status.values:
                raise serializers.ValidationError({'status': 'Неизвестный статус.'})
            orders = orders.filter(status=status)
        day = request.query_params.get('date')
        if day:
            try:
                parsed = parse_date(day)
            except ValueError:
                parsed = None
            if parsed is None:
                raise serializers.ValidationError({'date': 'Дата должна быть в формате ГГГГ-ММ-ДД.'})
            orders = orders.filter(created_at__date=parsed)
        courier = request.query_params.get('courier')
        if courier:
            if not courier.isdecimal():
                raise serializers.ValidationError({'courier': 'Некорректный курьер.'})
            orders = orders.filter(courier_id=courier)
        search = request.query_params.get('search', '').strip()
        if search:
            query = Q(number__icontains=search)
            if re.fullmatch(r'[+\d()\s-]+', search):
                digits = re.sub(r'\D', '', search)
                if digits:
                    phone_digits = F('phone')
                    for character in '+()- \t\r\n\u00a0\u2007\u202f':
                        phone_digits = Replace(phone_digits, Value(character), Value(''))
                    orders = orders.annotate(phone_digits=phone_digits)
                    query |= Q(phone_digits__contains=digits)
            orders = orders.filter(query)
        limit = serializers.IntegerField(min_value=1, max_value=MAX_ORDER_LIST_LIMIT).run_validation(request.query_params.get('limit', DEFAULT_ORDER_LIST_LIMIT))
        return Response(order_serializer_for(request.user)(orders[:limit], many=True).data)

    @transaction.atomic
    def post(self, request):
        if request.user.role != 'CUSTOMER':
            raise PermissionDenied('Заказ оформляется из аккаунта покупателя.')
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        fingerprint = hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()
        # One customer lock serializes same-key concurrent requests on PostgreSQL.
        # The database uniqueness constraint is the final integrity boundary.
        actor = lock_active_actor(request.user, ('CUSTOMER',))
        existing = Order.objects.filter(customer=actor, idempotency_key=data['idempotency_key']).first()
        if existing:
            if existing.request_fingerprint != fingerprint:
                return Response({'detail': 'Этот ключ оформления уже использован для другого содержимого заказа.', 'code': 'IDEMPOTENCY_CONFLICT', 'order_id': existing.pk, 'number': existing.number}, status=409)
            return order_response(existing, request.user)
        if data['expected_delivery_fee'] != settings.DELIVERY_FEE:
            raise Conflict('Стоимость доставки изменилась. Обновите корзину и подтвердите новую сумму.')
        items = data['items']
        ids = [item['product_id'] for item in items]
        products = {p.pk: p for p in Product.objects.select_related('category').select_for_update().filter(pk__in=ids).order_by('pk')}
        subtotal = Decimal('0.00')
        for item in items:
            product = products.get(item['product_id'])
            if not product or not product.is_visible or not product.category.is_visible or not product.is_available:
                raise Conflict('Один из товаров больше недоступен. Обновите корзину перед оформлением.')
            # Server prices are authoritative; a zero or negative price is never orderable.
            if product.price <= 0 or product.price != item['expected_price']:
                raise Conflict('Цена товара изменилась. Обновите корзину и подтвердите новую сумму.')
            subtotal += product.price * item['quantity']
        # Money is Decimal end to end; the sum is fixed to kopecks so storage never has to round it.
        subtotal = subtotal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        order = Order.objects.create(customer=actor, recipient_name=data['recipient_name'], phone=data['phone'], address=data['address'], comment=data['comment'], subtotal=subtotal, delivery_fee=settings.DELIVERY_FEE, total=subtotal + settings.DELIVERY_FEE, idempotency_key=data['idempotency_key'], request_fingerprint=fingerprint)
        OrderItem.objects.bulk_create([OrderItem(order=order, product=products[item['product_id']], name=products[item['product_id']].name, price=products[item['product_id']].price, image=products[item['product_id']].image, quantity=item['quantity']) for item in items])
        StatusHistory.objects.create(order=order, from_status='', to_status='NEW', actor=actor, actor_name=actor.name)
        return order_response(order, request.user, status=201)

class OrderDetail(APIView):
    def get(self, request, pk):
        order = get_object_or_404(scoped_orders(request.user), pk=pk)
        return Response(order_serializer_for(request.user)(order).data)

class Transition(APIView):
    @transaction.atomic
    def post(self, request, pk):
        order = locked_order(request.user, pk)
        if request.user.role not in ('ADMIN', 'COURIER'):
            raise PermissionDenied('Ваша роль не может менять статус заказа.')
        actor = lock_active_actor(request.user, ('ADMIN', 'COURIER'))
        target = request.data.get('status')
        if target not in Order.Status.values:
            raise serializers.ValidationError({'status': 'Неизвестный статус.'})
        if order.status in ('CANCELLED', 'DELIVERED'):
            raise Conflict('Заказ завершён. Его статус больше нельзя изменить.')
        if target == 'CANCELLED':
            if actor.role != 'ADMIN':
                raise PermissionDenied('Отмена доступна только администратору.')
            reason = serializers.CharField(max_length=2000).run_validation(request.data.get('reason'))
            order.cancellation_reason = reason
        else:
            role_targets = {'ADMIN': ('CONFIRMED', 'PREPARING', 'READY'), 'COURIER': ('HANDED_OVER', 'IN_TRANSIT', 'DELIVERED')}
            if target not in role_targets.get(actor.role, ()):
                raise PermissionDenied('Этот переход недоступен вашей роли.')
            next_state = {'NEW': 'CONFIRMED', 'CONFIRMED': 'PREPARING', 'PREPARING': 'READY', 'READY': 'HANDED_OVER', 'HANDED_OVER': 'IN_TRANSIT', 'IN_TRANSIT': 'DELIVERED'}
            if next_state.get(order.status) != target:
                raise Conflict('Статусы должны изменяться по порядку. Обновите заказ.')
        old = order.status
        order.status = target
        order.save(update_fields=['status', 'cancellation_reason'])
        StatusHistory.objects.create(order=order, from_status=old, to_status=target, actor=actor, actor_name=actor.name)
        return order_response(order, request.user)

class Assign(APIView):
    @transaction.atomic
    def post(self, request, pk):
        order = locked_order(request.user, pk)
        if request.user.role != 'ADMIN':
            raise PermissionDenied('Назначение курьера доступно только администратору.')
        lock_active_actor(request.user, ('ADMIN',))
        # A blocked courier cannot finish a delivery, and an admin cannot advance it, so only reassignment can unblock the order.
        courier_blocked = order.status in ('HANDED_OVER', 'IN_TRANSIT') and order.courier is not None and not order.courier.is_active
        if order.status not in ('NEW', 'CONFIRMED', 'PREPARING', 'READY') and not courier_blocked:
            raise Conflict('После передачи курьеру или отмены переназначение недоступно.')
        courier_id = serializers.IntegerField(min_value=1).run_validation(request.data.get('courier_id'))
        courier = User.objects.select_for_update().filter(pk=courier_id, role='COURIER', is_active=True).first()
        if not courier:
            raise serializers.ValidationError({'courier_id': 'Выберите активного курьера.'})
        order.courier = courier
        order.save(update_fields=['courier'])
        return order_response(order, request.user)

class ReportProblem(APIView):
    @transaction.atomic
    def post(self, request, pk):
        order = locked_order(request.user, pk)
        if request.user.role not in ('ADMIN', 'COURIER'):
            raise PermissionDenied('Сообщение о проблеме доступно курьеру и администратору.')
        actor = lock_active_actor(request.user, ('ADMIN', 'COURIER'))
        message = serializers.CharField(max_length=2000, validators=[reject_markup]).run_validation(request.data.get('message'))
        Problem.objects.create(order=order, message=message, actor=actor, actor_name=actor.name)
        return order_response(order, request.user, status=201)
