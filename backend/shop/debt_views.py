"""Orders delivered on credit ('в долг') and their settlement."""
import uuid
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, Payment
from .order_views import Conflict, order_response
from .security import lock_active_actor

DEBT_ROLES = ('ADMIN', 'CASHIER', 'COURIER')


def credit_orders(user):
    if not user.is_active or user.role not in DEBT_ROLES:
        raise PermissionDenied('Раздел долгов доступен администратору, кассиру и курьеру.')
    orders = Order.objects.filter(on_credit=True, status='DELIVERED').select_related('customer', 'payment', 'courier')
    # A courier sees the debts of the orders they delivered.
    return orders.filter(courier=user) if user.role == 'COURIER' else orders


def amount(value):
    return format(value or Decimal('0'), '.2f')


def debt_order(order):
    paid = getattr(order, 'payment', None)
    return {
        'id': order.id, 'number': order.number, 'created_at': order.created_at, 'credit_at': order.credit_at,
        'total': amount(order.total), 'address': order.address, 'recipient_name': order.recipient_name, 'phone': order.phone,
        'courier_name': order.courier.name if order.courier else '', 'credit_by_name': order.credit_by_name,
        'payment_status': 'PAID' if paid else 'DEBT', 'paid_at': paid.paid_at if paid else None, 'paid_by_name': paid.paid_by_name if paid else '',
    }


class Debts(APIView):
    """Customers with orders on credit, grouped by customer. ?state=open (default), paid or all."""

    def get(self, request):
        orders = credit_orders(request.user)
        open_orders = orders.filter(payment__isnull=True)
        paid_orders = orders.filter(payment__isnull=False)
        state = request.query_params.get('state', 'open')
        shown = {'open': open_orders, 'paid': paid_orders}.get(state, orders)
        customers = {}
        for order in shown.order_by('-credit_at', '-id'):
            customer = order.customer
            entry = customers.setdefault(customer.pk, {
                'id': customer.pk, 'name': customer.name, 'email': customer.email, 'phone': customer.phone,
                'account_type': customer.account_type, 'company_name': customer.company_name if customer.account_type == 'BUSINESS' else '',
                'debt_total': Decimal('0'), 'debt_count': 0, 'paid_total': Decimal('0'), 'paid_count': 0, 'orders': [],
            })
            paid = getattr(order, 'payment', None) is not None
            entry['paid_total' if paid else 'debt_total'] += order.total
            entry['paid_count' if paid else 'debt_count'] += 1
            entry['orders'].append(debt_order(order))
        rows = sorted(customers.values(), key=lambda row: (-row['debt_total'], -row['paid_total']))
        for row in rows:
            row['debt_total'] = amount(row['debt_total'])
            row['paid_total'] = amount(row['paid_total'])
        open_sum = open_orders.aggregate(total=Sum('total'), count=Count('id'))
        paid_sum = paid_orders.aggregate(total=Sum('total'), count=Count('id'))
        return Response({
            'state': state if state in ('open', 'paid') else 'all', 'customers': rows,
            'open_total': amount(open_sum['total']), 'open_count': open_sum['count'],
            'paid_total': amount(paid_sum['total']), 'paid_count': paid_sum['count'],
        })


class PayDebt(APIView):
    """Record that the money for an order on credit has been received."""

    @transaction.atomic
    def post(self, request, pk):
        order = get_object_or_404(credit_orders(request.user).select_for_update(of=('self',)), pk=pk)
        actor = lock_active_actor(request.user, DEBT_ROLES)
        if Payment.objects.filter(order=order).exists():
            raise Conflict('Этот долг уже отмечен как оплаченный. Обновите список.')
        Payment.objects.create(order=order, amount=order.total, method='CASH', idempotency_key=uuid.uuid4(), paid_by=actor, paid_by_name=actor.name)
        return order_response(order, request.user)


class MyDebt(APIView):
    """The signed-in customer's unpaid orders on credit, for the reminder in their account."""

    def get(self, request):
        orders = Order.objects.filter(customer=request.user, on_credit=True, status='DELIVERED', payment__isnull=True).order_by('-credit_at', '-id')
        total = orders.aggregate(total=Sum('total'))['total']
        return Response({'total': amount(total), 'count': orders.count(), 'orders': [{'id': o.id, 'number': o.number, 'total': amount(o.total), 'credit_at': o.credit_at} for o in orders[:50]]})
