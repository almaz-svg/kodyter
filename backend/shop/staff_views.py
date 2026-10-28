from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, Payment
from .order_views import Conflict, order_response
from .security import IsCashierOrAdmin, IsCourier, lock_active_actor
from .serializers import AvailableOrderSerializer, PaymentRequestSerializer


AVAILABLE_STATUSES = ('NEW', 'CONFIRMED', 'PREPARING', 'READY')


class AvailableOrders(APIView):
    permission_classes = [IsCourier]

    def get(self, request):
        orders = Order.objects.filter(courier__isnull=True, status__in=AVAILABLE_STATUSES).prefetch_related('items')
        return Response(AvailableOrderSerializer(orders, many=True).data)


class ClaimOrder(APIView):
    permission_classes = [IsCourier]

    @transaction.atomic
    def post(self, request, pk):
        order = Order.objects.select_for_update().filter(pk=pk).first()
        actor = lock_active_actor(request.user, ('COURIER',))
        if order is None:
            raise Conflict('Заказ уже принят другим курьером или больше недоступен.')
        if order.courier_id == actor.pk:
            return order_response(order)
        if order.courier_id is not None or order.status not in AVAILABLE_STATUSES:
            raise Conflict('Заказ уже принят другим курьером или больше недоступен.')
        order.courier = actor
        order.save(update_fields=['courier'])
        return order_response(order)


class ReceivePayment(APIView):
    permission_classes = [IsCashierOrAdmin]

    @transaction.atomic
    def post(self, request, pk):
        serializer = PaymentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = get_object_or_404(Order.objects.select_for_update(), pk=pk)
        actor = lock_active_actor(request.user, ('CASHIER', 'ADMIN'))
        if Payment.objects.filter(idempotency_key=data['idempotency_key']).exclude(order=order).exists():
            raise Conflict('Этот ключ оплаты уже использован для другого заказа. Обновите список заказов.')
        if Payment.objects.filter(order=order).exists():
            return order_response(order)
        if order.status != 'DELIVERED':
            raise Conflict('Оплату можно принять только после доставки заказа.')
        try:
            # A savepoint contains a cross-worker unique-key collision.
            with transaction.atomic():
                Payment.objects.create(order=order, amount=order.total, method=data['method'], idempotency_key=data['idempotency_key'], paid_by=actor, paid_by_name=actor.name)
        except IntegrityError:
            raise Conflict('Эта оплата уже зарегистрирована. Обновите список заказов.')
        return order_response(order, status=201)


class CashierSummary(APIView):
    permission_classes = [IsCashierOrAdmin]

    def get(self, request):
        day = serializers.DateField().run_validation(request.query_params.get('date', timezone.localdate().isoformat()))
        cash = Payment.objects.filter(method='CASH', paid_at__date=day).aggregate(total=Sum('amount'), count=Count('id'))
        unpaid = Order.objects.filter(status='DELIVERED', payment__isnull=True).aggregate(total=Sum('total'), count=Count('id'))
        return Response({'date': day.isoformat(), 'currency': 'KZT', 'cash_received': format(cash['total'] or Decimal('0'), '.2f'), 'paid_count': cash['count'], 'unpaid_delivered_total': format(unpaid['total'] or Decimal('0'), '.2f'), 'unpaid_delivered_count': unpaid['count']})
