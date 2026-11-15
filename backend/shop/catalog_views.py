from django.conf import settings
from django.db import IntegrityError, connection, OperationalError
from django.db.models import ProtectedError, Q
from rest_framework import generics, serializers
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Category, Product, User
from django.db import transaction
from .dispatch import dispatch_waiting_orders
from .security import IsAdmin
from .serializers import BusinessAccountSerializer, CategorySerializer, ProductSerializer, PublicProductSerializer, RegisterSerializer, UserSerializer, CourierUpdateSerializer

class Categories(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    queryset = Category.objects.filter(is_visible=True)

class Products(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicProductSerializer

    def get_queryset(self):
        products = Product.objects.filter(is_visible=True, category__is_visible=True)
        category = self.request.query_params.get('category')
        if category:
            products = products.filter(category_id=category) if category.isdecimal() else products.filter(category__slug=category)
        search = self.request.query_params.get('search', '').strip()
        if search:
            products = products.filter(Q(name__icontains=search) | Q(description__icontains=search))
        return products

class ProductDetail(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicProductSerializer
    queryset = Product.objects.filter(is_visible=True, category__is_visible=True)

class StoreSettings(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        return Response({'currency': 'KZT', 'delivery_fee': str(settings.DELIVERY_FEE), 'demo_mode': settings.DEMO_MODE, 'payment_method': 'CASH_ON_DELIVERY'})

class Health(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
        except OperationalError:
            return Response({'status': 'unavailable'}, status=503)
        return Response({'status': 'ok'})

class AdminCategories(generics.ListCreateAPIView):
    permission_classes = [IsAdmin]
    serializer_class = CategorySerializer
    queryset = Category.objects.all()

class CategoryInUse(APIException):
    status_code = 409
    default_detail = 'В этой категории есть товары, поэтому удалить её нельзя. Сначала перенесите товары в другую категорию или удалите их — либо просто скройте категорию.'

class AdminCategory(generics.UpdateAPIView, generics.DestroyAPIView):
    permission_classes = [IsAdmin]
    serializer_class = CategorySerializer
    queryset = Category.objects.all()
    http_method_names = ['patch', 'delete', 'options']

    def perform_destroy(self, instance):
        if instance.products.exists():
            raise CategoryInUse()
        try:
            instance.delete()
        except ProtectedError:
            raise CategoryInUse()

class AdminProducts(generics.ListCreateAPIView):
    permission_classes = [IsAdmin]
    serializer_class = ProductSerializer
    queryset = Product.objects.all()

class ProductInUse(APIException):
    status_code = 409
    default_detail = 'Товар уже есть в оформленных заказах, поэтому удалить его нельзя — иначе история заказов потеряет позицию. Скройте товар из каталога.'

class AdminProduct(generics.UpdateAPIView, generics.DestroyAPIView):
    permission_classes = [IsAdmin]
    serializer_class = ProductSerializer
    queryset = Product.objects.all()
    http_method_names = ['patch', 'delete', 'options']

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ProductInUse()

class AdminCouriers(APIView):
    permission_classes = [IsAdmin]
    role = 'COURIER'

    def get(self, request):
        return Response(UserSerializer(User.objects.filter(role=self.role).order_by('name'), many=True).data)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            courier = User.objects.create_user(**serializer.validated_data, role=self.role)
        except IntegrityError:
            raise serializers.ValidationError({'email': 'Этот email уже зарегистрирован.'})
        if self.role == 'COURIER':
            with transaction.atomic():
                dispatch_waiting_orders()
        return Response(UserSerializer(courier).data, status=201)

class AdminCourier(generics.UpdateAPIView):
    permission_classes = [IsAdmin]
    queryset = User.objects.filter(role='COURIER')
    serializer_class = CourierUpdateSerializer
    http_method_names = ['patch', 'options']

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if user.role == 'COURIER' and user.is_active:
            with transaction.atomic():
                dispatch_waiting_orders()
        return Response(UserSerializer(user).data)

class AdminCashiers(AdminCouriers):
    role = 'CASHIER'

class AdminCashier(AdminCourier):
    queryset = User.objects.filter(role='CASHIER')

class AdminBusinesses(generics.ListAPIView):
    """Business ('заведение') accounts with their approval state, for the administrator to review."""
    permission_classes = [IsAdmin]
    serializer_class = BusinessAccountSerializer
    queryset = User.objects.filter(account_type=User.AccountType.BUSINESS).order_by('company_name', 'id')

class AdminBusiness(generics.UpdateAPIView):
    """Approve or revoke wholesale prices. Non-business accounts are not found here."""
    permission_classes = [IsAdmin]
    serializer_class = BusinessAccountSerializer
    queryset = User.objects.filter(account_type=User.AccountType.BUSINESS)
    http_method_names = ['patch', 'options']
