from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Payment, User
from .test_staff_workflow import StaffFixtures


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'], AUTO_DISPATCH_COURIERS=False)
class DebtTests(StaffFixtures, APITestCase):
    def setUp(self):
        cache.clear()
        self.make_users()

    def deliver(self, body, courier=None):
        courier = courier or self.couriers[0]
        order = self.make_order(status='IN_TRANSIT', courier=courier)
        self.client.force_login(courier)
        response = self.client.post(f'/api/orders/{order.pk}/transition/', {'status': 'DELIVERED', **body}, format='json')
        return order, response

    def test_courier_delivers_on_credit_and_customer_owes(self):
        order, response = self.deliver({'on_credit': True})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DELIVERED')
        self.assertEqual(response.json()['payment_status'], 'DEBT')
        self.assertEqual(response.json()['credit_by_name'], 'Courier 0')
        self.assertFalse(Payment.objects.filter(order=order).exists())
        self.client.force_login(self.customer)
        mine = self.client.get('/api/debts/mine/').json()
        self.assertEqual((mine['total'], mine['count']), ('2400.00', 1))
        self.assertEqual(self.client.get(f'/api/orders/{order.pk}/').json()['payment_status'], 'DEBT')
        self.client.force_login(self.cashier)
        summary = self.client.get('/api/cashier/summary/').json()
        self.assertEqual((summary['debt_total'], summary['debt_count'], summary['unpaid_delivered_count']), ('2400.00', 1, 1))

    def test_cash_and_credit_together_is_rejected(self):
        order, response = self.deliver({'on_credit': True, 'cash_received': True})
        self.assertEqual(response.status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.status, 'IN_TRANSIT')

    def test_debt_list_groups_by_customer_and_payment_settles_it(self):
        order, _ = self.deliver({'on_credit': True})
        self.deliver({'cash_received': True})
        self.client.force_login(self.admin)
        data = self.client.get('/api/debts/').json()
        self.assertEqual((data['open_total'], data['open_count']), ('2400.00', 1))
        self.assertEqual([row['id'] for row in data['customers']], [self.customer.pk])
        self.assertEqual([row['id'] for row in data['customers'][0]['orders']], [order.pk])
        paid = self.client.post(f'/api/debts/{order.pk}/pay/', {}, format='json')
        self.assertEqual(paid.status_code, 200)
        self.assertEqual(paid.json()['payment_status'], 'PAID')
        self.assertEqual(paid.json()['paid_by_name'], 'Admin')
        self.assertEqual(self.client.post(f'/api/debts/{order.pk}/pay/', {}, format='json').status_code, 409)
        self.assertEqual(self.client.get('/api/debts/').json()['customers'], [])
        settled = self.client.get('/api/debts/?state=paid').json()
        self.assertEqual((settled['paid_count'], settled['customers'][0]['orders'][0]['payment_status']), (1, 'PAID'))
        self.client.force_login(self.customer)
        self.assertEqual(self.client.get('/api/debts/mine/').json()['count'], 0)

    def test_courier_sees_and_settles_only_own_debts(self):
        own, _ = self.deliver({'on_credit': True})
        other, _ = self.deliver({'on_credit': True}, courier=self.couriers[1])
        self.client.force_login(self.couriers[0])
        rows = self.client.get('/api/debts/').json()['customers'][0]['orders']
        self.assertEqual([row['id'] for row in rows], [own.pk])
        self.assertEqual(self.client.post(f'/api/debts/{other.pk}/pay/', {}, format='json').status_code, 404)
        self.assertEqual(self.client.post(f'/api/debts/{own.pk}/pay/', {}, format='json').status_code, 200)

    def test_customers_and_pastry_cannot_open_debt_list(self):
        pastry = User.objects.create_user(email='pastry@staff.test', password='Staff-password-123!', name='Chef', role='PASTRY')
        order, _ = self.deliver({'on_credit': True})
        for user in (self.customer, pastry):
            self.client.force_login(user)
            self.assertEqual(self.client.get('/api/debts/').status_code, 403)
            self.assertEqual(self.client.post(f'/api/debts/{order.pk}/pay/', {}, format='json').status_code, 403)

    def test_admin_cannot_put_order_on_credit(self):
        order = self.make_order(status='IN_TRANSIT', courier=self.couriers[0])
        order.on_credit = False
        self.client.force_login(self.admin)
        self.client.post(f'/api/orders/{order.pk}/transition/', {'status': 'DELIVERED', 'on_credit': True}, format='json')
        order.refresh_from_db()
        self.assertFalse(order.on_credit)
