"""Automatic courier dispatch: every waiting order goes to a free courier without an administrator choosing one.

A courier is free when they are active and have no unfinished delivery. Waiting orders are handed out oldest first,
and the courier who has gone longest without a new order gets the next one, so work is spread evenly.
"""
from django.conf import settings
from django.db.models import Count, F, Max, Q

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


def release_courier_orders(courier):
    """Move a leaving courier's unfinished orders to other couriers. Call inside a transaction.

    Orders still at the bakery go back to the queue and are dispatched as usual. Orders already on the road
    go straight to a free courier, or to the active courier with the fewest unfinished orders when nobody is free.
    Returns (moved, waiting): orders handed to someone else, and orders left without a courier for now.
    """
    open_orders = list(Order.objects.select_for_update().filter(courier=courier).exclude(status__in=FINISHED_STATUSES).order_by('created_at', 'pk'))
    road = [order for order in open_orders if order.status not in WAITING_STATUSES]
    queued = [order for order in open_orders if order.status in WAITING_STATUSES]
    for order in queued:
        order.courier = None
        order.save(update_fields=['courier'])
    moved_road = 0
    for order in road:
        target = next((pk for pk in _free_courier_ids() if pk != courier.pk), None)
        if target is None:
            busiest_last = (User.objects.filter(role='COURIER', is_active=True).exclude(pk=courier.pk)
                            .annotate(load=Count('deliveries', filter=~Q(deliveries__status__in=FINISHED_STATUSES)))
                            .order_by('load', 'pk').values_list('pk', flat=True).first())
            target = busiest_last
        if target is None:
            continue  # No other courier exists; the admin reassigns it once one is added.
        order.courier_id = target
        order.save(update_fields=['courier'])
        moved_road += 1
    assigned = {order.pk for order in dispatch_waiting_orders()}
    moved_queued = sum(1 for order in queued if order.pk in assigned)
    return moved_road + moved_queued, (len(road) - moved_road) + (len(queued) - moved_queued)


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
