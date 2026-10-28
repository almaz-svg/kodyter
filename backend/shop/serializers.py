from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
import re
from .models import User, Category, Product, Order, OrderItem, StatusHistory, Problem

class PartialUpdateMixin:
    def update(self, instance, validated_data):
        # Concurrent edits of unrelated fields must not overwrite each other.
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if validated_data:
            instance.save(update_fields=list(validated_data))
        return instance

class UserSerializer(PartialUpdateMixin, serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'phone', 'role', 'is_active']
        read_only_fields = ['id', 'email', 'role', 'is_active']

class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Этот email уже зарегистрирован.')
        return value

    def validate(self, data):
        try:
            validate_password(data['password'], User(email=data['email'], name=data['name']))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return data

class CategorySerializer(PartialUpdateMixin, serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image', 'is_visible']

class ProductSerializer(PartialUpdateMixin, serializers.ModelSerializer):
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    class Meta:
        model = Product
        fields = ['id', 'category', 'name', 'description', 'image', 'price', 'weight', 'ingredients', 'allergens', 'is_available', 'is_visible']

class CourierUpdateSerializer(PartialUpdateMixin, serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['name', 'phone', 'is_active']

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'product_id', 'name', 'price', 'quantity', 'image']

class StatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusHistory
        fields = ['id', 'from_status', 'to_status', 'created_at', 'actor_name']

class ProblemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Problem
        fields = ['id', 'message', 'created_at', 'actor_name']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = StatusHistorySerializer(many=True, read_only=True)
    problems = ProblemSerializer(many=True, read_only=True)
    courier_name = serializers.CharField(source='courier.name', default=None, read_only=True)
    payment_status = serializers.SerializerMethodField()
    paid_at = serializers.DateTimeField(source='payment.paid_at', default=None, read_only=True)
    paid_by = serializers.IntegerField(source='payment.paid_by_id', default=None, read_only=True)
    paid_by_name = serializers.CharField(source='payment.paid_by_name', default=None, read_only=True)

    def get_payment_status(self, order):
        return 'PAID' if getattr(order, 'payment', None) else 'UNPAID'

    class Meta:
        model = Order
        fields = ['id', 'number', 'created_at', 'status', 'recipient_name', 'phone', 'address', 'comment', 'subtotal', 'delivery_fee', 'total', 'courier', 'courier_name', 'items', 'status_history', 'problems', 'cancellation_reason', 'payment_status', 'paid_at', 'paid_by', 'paid_by_name']
        read_only_fields = fields

class AvailableItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['name', 'quantity']

class AvailableOrderSerializer(serializers.ModelSerializer):
    items = AvailableItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()

    def get_items_count(self, order):
        return sum(item.quantity for item in order.items.all())

    class Meta:
        model = Order
        fields = ['id', 'number', 'status', 'created_at', 'total', 'address', 'items_count', 'items']

class PaymentRequestSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=['CASH'])
    idempotency_key = serializers.UUIDField()

class CheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=99)
    expected_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)

class CheckoutSerializer(serializers.Serializer):
    recipient_name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=30)
    address = serializers.CharField(max_length=500, min_length=5)
    comment = serializers.CharField(max_length=2000, required=False, allow_blank=True, default='')
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
