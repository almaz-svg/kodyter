from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, OrderItem, Payment
from .order_views import Conflict, order_response
from .security import IsAdmin, IsCashierOrAdmin, IsCourier, lock_active_actor
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
            return order_response(order, request.user)
        if order.courier_id is not None or order.status not in AVAILABLE_STATUSES:
            raise Conflict('Заказ уже принят другим курьером или больше недоступен.')
        order.courier = actor
        order.save(update_fields=['courier'])
        return order_response(order, request.user)


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
            return order_response(order, request.user)
        if order.status != 'DELIVERED':
            raise Conflict('Оплату можно принять только после доставки заказа.')
        try:
            # A savepoint contains a cross-worker unique-key collision.
            with transaction.atomic():
                Payment.objects.create(order=order, amount=order.total, method=data['method'], idempotency_key=data['idempotency_key'], paid_by=actor, paid_by_name=actor.name)
        except IntegrityError:
            raise Conflict('Эта оплата уже зарегистрирована. Обновите список заказов.')
        return order_response(order, request.user, status=201)


class AdminOverview(APIView):
    """Counts for the admin's 'needs attention' block. Each count matches a status filter in the orders list."""
    permission_classes = [IsAdmin]

    def get(self, request):
        orders = Order.objects.all()
        return Response({
            'new': orders.filter(status='NEW').count(),
            'unassigned': orders.filter(courier__isnull=True, status__in=AVAILABLE_STATUSES).count(),
            'on_the_way': orders.filter(status__in=('HANDED_OVER', 'IN_TRANSIT')).count(),
            'unpaid_delivered': orders.filter(status='DELIVERED', payment__isnull=True).count(),
        })


class CashierSummary(APIView):
    permission_classes = [IsCashierOrAdmin]

    def get(self, request):
        params = request.query_params
        day = serializers.DateField().run_validation(params.get('date', timezone.localdate().isoformat()))
        start = serializers.DateField().run_validation(params['date_from']) if params.get('date_from') else day
        end = serializers.DateField().run_validation(params['date_to']) if params.get('date_to') else start
        if end < start:
            raise serializers.ValidationError({'date_to': 'Конец периода раньше начала.'})
        cash = Payment.objects.filter(method='CASH', paid_at__date__gte=start, paid_at__date__lte=end).aggregate(total=Sum('amount'), count=Count('id'))
        unpaid = Order.objects.filter(status='DELIVERED', payment__isnull=True).aggregate(total=Sum('total'), count=Count('id'))
        # Purchases placed in the period; cancelled orders are counted separately and excluded from the sum.
        placed = Order.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
        sales = placed.exclude(status='CANCELLED').aggregate(total=Sum('total'), count=Count('id'))
        items = OrderItem.objects.filter(order__in=placed.exclude(status='CANCELLED')).aggregate(count=Sum('quantity'))
        return Response({'date': start.isoformat(), 'date_from': start.isoformat(), 'date_to': end.isoformat(), 'currency': 'KZT', 'cash_received': format(cash['total'] or Decimal('0'), '.2f'), 'paid_count': cash['count'], 'unpaid_delivered_total': format(unpaid['total'] or Decimal('0'), '.2f'), 'unpaid_delivered_count': unpaid['count'], 'orders_total': format(sales['total'] or Decimal('0'), '.2f'), 'orders_count': sales['count'], 'items_count': items['count'] or 0, 'cancelled_count': placed.filter(status='CANCELLED').count()})
