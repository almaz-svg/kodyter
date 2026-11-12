from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.conf import settings
from rest_framework import serializers
import re
from .models import User, Category, Product, Order, OrderItem, StatusHistory, Problem
from .security import reject_markup, validate_image_reference
from decimal import Decimal

class MarkupFreeMixin:
    """Refuses HTML-like text in every submitted string field, before it reaches the database."""
    def validate(self, attrs):
        attrs = super().validate(attrs)
        for value in attrs.values():
            try:
                reject_markup(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.messages)
        return attrs

class PartialUpdateMixin:
    def update(self, instance, validated_data):
        # Concurrent edits of unrelated fields must not overwrite each other.
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if validated_data:
            instance.save(update_fields=list(validated_data))
        return instance

class UserSerializer(MarkupFreeMixin, PartialUpdateMixin, serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'phone', 'role', 'is_active', 'account_type', 'company_name', 'business_approved']
        # The account type is chosen at registration only, and approval is set only by an administrator.
        read_only_fields = ['id', 'email', 'role', 'is_active', 'account_type', 'company_name', 'business_approved']

class BusinessAccountSerializer(serializers.ModelSerializer):
    """Admin view of business accounts. Only `business_approved` can be written."""
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'phone', 'company_name', 'business_approved']
        read_only_fields = ['id', 'name', 'email', 'phone', 'company_name']

class RegisterSerializer(MarkupFreeMixin, serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    account_type = serializers.ChoiceField(choices=User.AccountType.choices, default=User.AccountType.INDIVIDUAL)
    company_name = serializers.CharField(max_length=160, required=False, allow_blank=True, default='')

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Этот email уже зарегистрирован.')
        return value

    def validate(self, data):
        data = super().validate(data)
        if data['account_type'] == User.AccountType.BUSINESS and not data.get('company_name', '').strip():
            raise serializers.ValidationError({'company_name': 'Укажите название заведения.'})
        try:
            validate_password(data['password'], User(email=data['email'], name=data['name']))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return data

class CategorySerializer(MarkupFreeMixin, PartialUpdateMixin, serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image', 'is_visible']
        extra_kwargs = {'image': {'validators': [validate_image_reference]}}

class ProductSerializer(MarkupFreeMixin, PartialUpdateMixin, serializers.ModelSerializer):
    """Admin view and input: `price` is the retail price, `wholesale_price` is the business price."""
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    wholesale_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'), required=False, allow_null=True)

    class Meta:
        model = Product
        fields = ['id', 'category', 'name', 'description', 'image', 'price', 'wholesale_price', 'weight', 'ingredients', 'allergens', 'is_available', 'is_visible']
        extra_kwargs = {'image': {'validators': [validate_image_reference]}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        price = attrs.get('price', self.instance.price if self.instance else None)
        wholesale = attrs.get('wholesale_price', self.instance.wholesale_price if self.instance else None)
        if wholesale is not None and price is not None and wholesale > price:
            raise serializers.ValidationError({'wholesale_price': 'Оптовая цена не может быть выше розничной.'})
        return attrs

class PublicProductSerializer(serializers.ModelSerializer):
    """Catalog view for every visitor. `price` is what this visitor pays; `retail_price` is the list price.
    Wholesale prices are never sent to the public. The list price is always retail: wholesale depends on the quantity in the
    order, which the catalog does not know. Only an approved business sees the offer next to the retail price."""
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    retail_price = serializers.DecimalField(source='price', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'category', 'name', 'description', 'image', 'price', 'retail_price', 'weight', 'ingredients', 'allergens', 'is_available', 'is_visible']
        read_only_fields = fields

    def to_representation(self, product):
        data = super().to_representation(product)
        user = getattr(self.context.get('request'), 'user', None)
        approved = getattr(user, 'account_type', None) == User.AccountType.BUSINESS and getattr(user, 'business_approved', False)
        if approved and product.wholesale_price is not None:
            data['wholesale_price'] = format(product.wholesale_price, '.2f')
            data['wholesale_min_qty'] = settings.WHOLESALE_MIN_QTY
        return data

class CourierUpdateSerializer(MarkupFreeMixin, PartialUpdateMixin, serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['name', 'phone', 'is_active']

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'product_id', 'name', 'price', 'quantity', 'image']
        read_only_fields = fields

class StatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusHistory
        fields = ['id', 'from_status', 'to_status', 'created_at', 'actor_name']
        read_only_fields = fields

class ProblemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Problem
        fields = ['id', 'message', 'created_at', 'actor_name']
        read_only_fields = fields

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = StatusHistorySerializer(many=True, read_only=True)
    problems = ProblemSerializer(many=True, read_only=True)
    courier_name = serializers.CharField(source='courier.name', default=None, read_only=True)
    courier_is_active = serializers.BooleanField(source='courier.is_active', default=None, read_only=True)
    payment_status = serializers.SerializerMethodField()
    paid_at = serializers.DateTimeField(source='payment.paid_at', default=None, read_only=True)
    paid_by =serializers.IntegerField(source='payment.paid_by_id', default=None, read_only=True)
    paid_by_name = serializers.CharField(source='payment.paid_by_name', default=None, read_only=True)

    def get_payment_status(self, order):
        return 'PAID' if getattr(order, 'payment', None) else 'UNPAID'

    class Meta:
        model = Order
        fields = ['id', 'number', 'created_at', 'status', 'recipient_name', 'phone', 'address', 'comment', 'subtotal', 'delivery_fee', 'total', 'courier', 'courier_name', 'courier_is_active', 'items', 'status_history', 'problems', 'cancellation_reason', 'payment_status', 'paid_at', 'paid_by', 'paid_by_name']
        read_only_fields = fields

class CustomerStatusHistorySerializer(serializers.ModelSerializer):
    # No actor_name: customers see when the status changed, not which employee changed it.
    class Meta:
        model = StatusHistory
        fields = ['id', 'from_status', 'to_status', 'created_at']
        read_only_fields = fields

class CustomerProblemSerializer(serializers.ModelSerializer):
    # No actor_name: the courier's or admin's name stays internal.
    class Meta:
        model = Problem
        fields = ['id', 'message', 'created_at']
        read_only_fields = fields

class CustomerOrderSerializer(serializers.ModelSerializer):
    """Order view for the customer who placed it. Staff identities and the cashier's receipt details are left out."""
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = CustomerStatusHistorySerializer(many=True, read_only=True)
    problems = CustomerProblemSerializer(many=True, read_only=True)
    courier_name = serializers.CharField(source='courier.name', default=None, read_only=True)
    payment_status = serializers.SerializerMethodField()
    paid_at = serializers.DateTimeField(source='payment.paid_at', default=None, read_only=True)

    def get_payment_status(self, order):
        return 'PAID' if getattr(order, 'payment', None) else 'UNPAID'

    class Meta:
        model = Order
        fields = ['id', 'number', 'created_at', 'status', 'recipient_name', 'phone', 'address', 'comment', 'subtotal', 'delivery_fee', 'total', 'courier', 'courier_name', 'items', 'status_history', 'problems', 'cancellation_reason', 'payment_status', 'paid_at']
        read_only_fields = fields

class AvailableItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['name', 'quantity']
        read_only_fields = fields

class AvailableOrderSerializer(serializers.ModelSerializer):
    items = AvailableItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()

    def get_items_count(self, order):
        return sum(item.quantity for item in order.items.all())

    class Meta:
        model = Order
        fields = ['id', 'number', 'status', 'created_at', 'total', 'address', 'items_count', 'items']
        read_only_fields = fields

class PaymentRequestSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=['CASH'])
    idempotency_key = serializers.UUIDField()

class CheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    # Whole number only: DRF rejects 1.5 and 'abc'. The maximum is read at validation time from settings.
    quantity = serializers.IntegerField(min_value=1)
    expected_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)

    def validate_quantity(self, value):
        limit = settings.MAX_ORDER_ITEM_QUANTITY
        if value > limit:
            raise serializers.ValidationError(f'Количество в одной позиции не может быть больше {limit}.')
        return value

class CheckoutSerializer(MarkupFreeMixin, serializers.Serializer):
    recipient_name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=30)
    address = serializers.CharField(max_length=500, min_length=5)
    comment = serializers.CharField(max_length=2000, min_length=1)
    items = CheckoutItemSerializer(many=True, allow_empty=False, max_length=100)
    expected_delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    idempotency_key = serializers.UUIDField()

    def validate_phone(self, value):
        if not re.fullmatch(r'[+\d()\s-]+', value) or not 10 <= len(re.sub(r'\D', '', value)) <= 15:
            raise serializers.ValidationError('Укажите телефон в международном формате, например +7 701 123 45 67.')
        return value

    def validate_items(self, items):
        ids = [item['product_id'] for item in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Объедините одинаковые товары в одну строку.')
        return items
