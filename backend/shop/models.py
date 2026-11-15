import uuid
from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        user = self.model(email=self.normalize_email(email).lower(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.update(is_staff=True, is_superuser=True, role='ADMIN')
        return self.create_user(email, password, **extra_fields)

# Marks a staff account removed by an administrator. The row stays so orders, history and receipts keep the name.
REMOVED_STAFF_MARK = '__removed__'

class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = 'CUSTOMER', 'Покупатель'
        ADMIN = 'ADMIN', 'Администратор'
        COURIER = 'COURIER', 'Курьер'
        CASHIER = 'CASHIER', 'Кассир'
        PASTRY = 'PASTRY', 'Кондитер'

    class AccountType(models.TextChoices):
        # Chosen at registration. A business ('заведение') pays the wholesale price where one is set.
        INDIVIDUAL = 'INDIVIDUAL', 'Физическое лицо'
        BUSINESS = 'BUSINESS', 'Заведение'

    username = None
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUSTOMER)
    account_type = models.CharField(max_length=10, choices=AccountType.choices, default=AccountType.INDIVIDUAL)
    company_name = models.CharField(max_length=160, blank=True)
    # Set only by an administrator. A business gets wholesale prices after approval, not at registration.
    business_approved = models.BooleanField(default=False)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    objects = UserManager()

    class Meta:
        constraints = [models.UniqueConstraint(Lower('email'), name='user_email_case_insensitive_unique')]

class Category(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    image = models.CharField(max_length=500, blank=True)
    is_visible = models.BooleanField(default=True)

    class Meta:
        ordering = ['id']

class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    image = models.CharField(max_length=500, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    # Optional wholesale price for business accounts. Empty means business customers pay the retail price.
    wholesale_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    weight = models.CharField(max_length=80, blank=True)
    ingredients = models.TextField(blank=True)
    allergens = models.TextField(blank=True)
    is_available = models.BooleanField(default=True)
    is_visible = models.BooleanField(default=True)

    def price_for(self, user, quantity=1):
        """Unit price this user pays for `quantity` units of this product in one order.
        Wholesale needs an approved business account, a wholesale price, and at least WHOLESALE_MIN_QTY units of this product.
        The count is per product: units of different products are never added together."""
        is_approved_business = getattr(user, 'account_type', None) == User.AccountType.BUSINESS and getattr(user, 'business_approved', False)
        if is_approved_business and self.wholesale_price is not None and quantity >= settings.WHOLESALE_MIN_QTY:
            return self.wholesale_price
        return self.price

    class Meta:
        ordering = ['id']
        constraints = [
            models.CheckConstraint(condition=models.Q(price__gte=0), name='product_price_nonnegative'),
            models.CheckConstraint(condition=models.Q(wholesale_price__isnull=True) | models.Q(wholesale_price__gte=0), name='product_wholesale_price_nonnegative'),
        ]

def order_number():
    return 'AN-' + uuid.uuid4().hex[:12].upper()

class Order(models.Model):
    class Status(models.TextChoices):
        NEW = 'NEW', 'Новый'
        CONFIRMED = 'CONFIRMED', 'Подтверждён'
        PREPARING = 'PREPARING', 'Готовится'
        READY = 'READY', 'Готов к выдаче'
        HANDED_OVER = 'HANDED_OVER', 'Передан курьеру'
        IN_TRANSIT = 'IN_TRANSIT', 'В пути'
        DELIVERED = 'DELIVERED', 'Доставлен'
        CANCELLED = 'CANCELLED', 'Отменён'

    number = models.CharField(max_length=20, unique=True, default=order_number, editable=False)
    customer = models.ForeignKey(User, on_delete=models.PROTECT, related_name='orders')
    courier = models.ForeignKey(User, on_delete=models.PROTECT, related_name='deliveries', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW, db_index=True)
    recipient_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30)
    address = models.CharField(max_length=500)
    comment = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    cancellation_reason = models.TextField(blank=True)
    idempotency_key = models.UUIDField()
    request_fingerprint = models.CharField(max_length=64)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [models.UniqueConstraint(fields=['customer', 'idempotency_key'], name='order_customer_idempotency_unique')]

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    name = models.CharField(max_length=160)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    image = models.CharField(max_length=500, blank=True)
    # Ticked by the pastry kitchen when this line of the order is cooked.
    is_prepared = models.BooleanField(default=False)

    class Meta:
        ordering = ['id']
        constraints = [models.CheckConstraint(condition=models.Q(quantity__gt=0), name='order_item_quantity_positive')]

class StatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(User, on_delete=models.PROTECT)
    actor_name = models.CharField(max_length=120)

    class Meta:
        ordering = ['created_at', 'id']

class Problem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='problems')
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(User, on_delete=models.PROTECT)
    actor_name = models.CharField(max_length=120)

    class Meta:
        ordering = ['created_at', 'id']

class Payment(models.Model):
    """One immutable receipt per order. The API exposes creation and reads only."""
    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name='payment')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=10, choices=[('CASH', 'Наличные')])
    idempotency_key = models.UUIDField(unique=True)
    paid_at = models.DateTimeField(auto_now_add=True, db_index=True)
    paid_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='payments_received')
    paid_by_name = models.CharField(max_length=120)

    class Meta:
        ordering = ['-paid_at', '-id']
        constraints = [models.CheckConstraint(condition=models.Q(amount__gte=0), name='payment_amount_nonnegative')]
