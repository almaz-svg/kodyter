"""Automatic courier dispatch: every waiting order goes to a free courier without an administrator choosing one.

A courier is free when they are active and have no unfinished delivery. Waiting orders are handed out oldest first,
and the courier who has gone longest without a new order gets the next one, so work is spread evenly.
"""
from django.conf import settings
from django.db.models import F, Max

from .models import Order, User

# Orders a courier can still be given; after READY the courier is already carrying it.
WAITING_STATUSES = ('NEW', 'CONFIRMED', 'PREPARING', 'READY')
FINISHED_STATUSES = ('DELIVERED', 'CANCELLED')


def _busy(courier_id):
    return Order.objects.filter(courier_id=courier_id).exclude(status__in=FINISHED_STATUSES).exists()


def _free_courier_ids():
    # Aggregates cannot be combined with row locks on PostgreSQL, so rank first and lock each candidate afterwards.
    return list(
        User.objects.filter(role='COURIER', is_active=True)
        .exclude(deliveries__in=Order.objects.exclude(status__in=FINISHED_STATUSES))
        .annotate(last_order=Max('deliveries__created_at'))
        .order_by(F('last_order').asc(nulls_first=True), 'pk')
        .values_list('pk', flat=True)
    )


def dispatch_waiting_orders():
    """Pair waiting orders with free couriers. Call inside a transaction; returns the orders that were assigned."""
    if not getattr(settings, 'AUTO_DISPATCH_COURIERS', True):
        return []
    assigned = []
    courier_ids = _free_courier_ids()
    if not courier_ids:
        return assigned
    # skip_locked: an order or courier another request is handling right now is simply left for the next dispatch.
    waiting = Order.objects.select_for_update(skip_locked=True).filter(courier__isnull=True, status__in=WAITING_STATUSES).order_by('created_at', 'pk')
    orders = iter(waiting)
    for courier_id in courier_ids:
        courier = User.objects.select_for_update(skip_locked=True).filter(pk=courier_id, role='COURIER', is_active=True).first()
        if courier is None or _busy(courier_id):
            continue
        order = next(orders, None)
        if order is None:
            break
        order.courier = courier
        order.save(update_fields=['courier'])
        assigned.append(order)
    return assigned
