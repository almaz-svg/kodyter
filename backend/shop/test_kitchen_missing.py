from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Category, OrderItem, Payment, Product, User
from .test_staff_workflow import StaffFixtures


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'], AUTO_DISPATCH_COURIERS=False)
class KitchenMissingTests(StaffFixtures, APITestCase):
    """The cook marks out-of-stock lines (the total is recalculated) or cancels an order that is not ready yet."""

    def setUp(self):
        cache.clear()
        self.make_users()
        self.chef = User.objects.create_user(email='chef@missing.test', password='Staff-password-123!', name='Chef', role='PASTRY')
        category = Category.objects.create(name='Bakery', slug='bakery-missing')
        self.bun = Product.objects.create(category=category, name='Bun', price='500.00')
        self.cake = Product.objects.create(category=category, name='Cake', price='2000.00')

    def order_with_lines(self, status='CONFIRMED'):
        order = self.make_order(status=status, total='4500.00')
        order.subtotal = Decimal('3000.00'); order.save(update_fields=['subtotal'])
        bun = OrderItem.objects.create(order=order, product=self.bun, name='Bun', price='500', quantity=2)
        cake = OrderItem.objects.create(order=order, product=self.cake, name='Cake', price='2000', quantity=1)
        return order, bun, cake

    def test_cook_marks_missing_line_and_total_is_recalculated(self):
        order, bun, cake = self.order_with_lines()
        self.client.force_login(self.chef)
        response = self.client.post(f'/api/orders/{order.pk}/missing/', {'item_ids': [cake.pk]}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual((Decimal(data['subtotal']), Decimal(data['total'])), (Decimal('1000.00'), Decimal('2500.00')))
        self.assertEqual({line['name']: line['is_missing'] for line in data['items']}, {'Bun': False, 'Cake': True})
        self.assertIn('Нет в наличии: Cake', data['problems'][0]['message'])
        # The customer sees the line marked and the new total.
        self.client.force_login(self.customer)
        mine = self.client.get(f'/api/orders/{order.pk}/').json()
        self.assertEqual(Decimal(mine['total']), Decimal('2500.00'))

    def test_all_lines_missing_is_refused(self):
        order, bun, cake = self.order_with_lines()
        self.client.force_login(self.chef)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/missing/', {'item_ids': [bun.pk, cake.pk]}, format='json').status_code, 409)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/missing/', {'item_ids': [cake.pk]}, format='json').status_code, 200)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/missing/', {'item_ids': [bun.pk]}, format='json').status_code, 409)

    def test_ready_or_paid_order_cannot_change(self):
        order, bun, cake = self.order_with_lines(status='READY')
        self.client.force_login(self.chef)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/missing/', {'item_ids': [cake.pk]}, format='json').status_code, 409)

    def test_courier_and_customer_cannot_mark_missing(self):
        order, bun, cake = self.order_with_lines()
        for user in (self.couriers[0], self.customer, self.cashier):
            self.client.force_login(user)
            self.assertIn(self.client.post(f'/api/orders/{order.pk}/missing/', {'item_ids': [cake.pk]}, format='json').status_code, (403, 404))
        cake.refresh_from_db()
        self.assertFalse(cake.is_missing)

    def test_cook_cancels_order_before_it_is_ready(self):
        order, _, _ = self.order_with_lines(status='PREPARING')
        self.client.force_login(self.chef)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/transition/', {'status': 'CANCELLED'}, format='json').status_code, 400)
        response = self.client.post(f'/api/orders/{order.pk}/transition/', {'status': 'CANCELLED', 'reason': 'Закончилась мука'}, format='json')
        self.assertEqual((response.status_code, response.json()['status'], response.json()['cancellation_reason']), (200, 'CANCELLED', 'Закончилась мука'))

    def test_cook_cannot_cancel_ready_order(self):
        order, _, _ = self.order_with_lines(status='READY')
        self.client.force_login(self.chef)
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/transition/', {'status': 'CANCELLED', 'reason': 'x'}, format='json').status_code, 409)

    def test_courier_still_cannot_cancel(self):
        order, _, _ = self.order_with_lines(status='CONFIRMED')
        order.courier = self.couriers[0]; order.save(update_fields=['courier'])
        self.client.force_login(self.couriers[0])
        self.assertEqual(self.client.post(f'/api/orders/{order.pk}/transition/', {'status': 'CANCELLED', 'reason': 'x'}, format='json').status_code, 403)
