import uuid

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Category, Order, Product, User
from .test_staff_workflow import StaffFixtures


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class AutomaticDispatchTests(StaffFixtures, APITestCase):
    def setUp(self):
        cache.clear()
        self.make_users()
        category = Category.objects.create(name='Bakery', slug='bakery')
        self.product = Product.objects.create(category=category, name='Croissant', price='900')

    def checkout(self):
        self.client.force_login(self.customer)
        response = self.client.post('/api/orders/', {'recipient_name': 'Buyer', 'phone': '+77011234567', 'address': 'Almaty Abai 1', 'comment': '', 'items': [{'product_id': self.product.pk, 'quantity': 2, 'expected_price': '900'}], 'expected_delivery_fee': '1500', 'idempotency_key': str(uuid.uuid4())}, format='json')
        self.assertEqual(response.status_code, 201)
        return Order.objects.get(pk=response.json()['id'])

    def move(self, order, actor, *statuses):
        self.client.force_login(actor)
        for status in statuses:
            response = self.client.post(f'/api/orders/{order.pk}/transition/', {'status': status, 'reason': 'Покупатель передумал'}, format='json')
            self.assertEqual(response.status_code, 200, response.content)

    def test_each_new_order_goes_to_a_different_free_courier_and_then_waits(self):
        first, second, third = self.checkout(), self.checkout(), self.checkout()
        self.assertEqual({first.courier, second.courier}, set(self.couriers))
        self.assertIsNone(third.courier)
        self.client.force_login(first.courier)
        self.assertEqual([row['id'] for row in self.client.get('/api/orders/').json()], [first.pk])

    def test_a_delivered_courier_immediately_gets_the_next_waiting_order(self):
        first, second, waiting = self.checkout(), self.checkout(), self.checkout()
        self.move(first, self.admin, 'CONFIRMED', 'PREPARING', 'READY')
        self.move(first, first.courier, 'HANDED_OVER', 'IN_TRANSIT', 'DELIVERED')
        waiting.refresh_from_db()
        self.assertEqual(waiting.courier, first.courier)

    def test_cancelling_an_order_frees_its_courier(self):
        first, second, waiting = self.checkout(), self.checkout(), self.checkout()
        self.move(second, self.admin, 'CANCELLED')
        waiting.refresh_from_db()
        self.assertEqual(waiting.courier, second.courier)

    def test_inactive_couriers_are_skipped_until_reactivated(self):
        blocked = self.couriers[1]
        blocked.is_active = False
        blocked.save(update_fields=['is_active'])
        first, waiting = self.checkout(), self.checkout()
        self.assertEqual(first.courier, self.couriers[0])
        self.assertIsNone(waiting.courier)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.patch(f'/api/admin/couriers/{blocked.pk}/', {'is_active': True}, format='json').status_code, 200)
        waiting.refresh_from_db()
        self.assertEqual(waiting.courier, blocked)

    def test_a_newly_added_courier_takes_a_waiting_order(self):
        self.checkout(), self.checkout()
        waiting = self.checkout()
        self.client.force_login(self.admin)
        response = self.client.post('/api/admin/couriers/', {'email': 'new@staff.test', 'password': 'Staff-password-123!', 'name': 'New courier', 'phone': '+77010000001'}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        waiting.refresh_from_db()
        self.assertEqual(waiting.courier, User.objects.get(email='new@staff.test'))

    @override_settings(AUTO_DISPATCH_COURIERS=False)
    def test_dispatch_can_be_switched_off(self):
        self.assertIsNone(self.checkout().courier)

    def test_a_courier_can_take_several_waiting_orders_at_once(self):
        mine, other, first_waiting, second_waiting = self.checkout(), self.checkout(), self.checkout(), self.checkout()
        courier = mine.courier
        self.client.force_login(courier)
        self.assertEqual({row['id'] for row in self.client.get('/api/courier/available-orders/').json()}, {first_waiting.pk, second_waiting.pk})
        for order in (first_waiting, second_waiting):
            self.assertEqual(self.client.post(f'/api/orders/{order.pk}/claim/', {}, format='json').status_code, 200)
        self.assertEqual({row['id'] for row in self.client.get('/api/orders/').json()}, {mine.pk, first_waiting.pk, second_waiting.pk})
        self.assertEqual(self.client.get('/api/courier/available-orders/').json(), [])
