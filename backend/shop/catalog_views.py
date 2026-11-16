from django.conf import settings
from django.db import IntegrityError, connection, OperationalError
from django.db.models import ProtectedError, Q
from rest_framework import generics, serializers
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import REMOVED_STAFF_MARK, Category, Product, User
from django.db import transaction
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from .dispatch import dispatch_waiting_orders, release_courier_orders
from .security import IsAdmin
from .serializers import BusinessAccountSerializer, CategorySerializer, ProductSerializer, PublicProductSerializer, StaffCreateSerializer, UserSerializer, CourierUpdateSerializer

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
        staff = User.objects.filter(role=self.role).exclude(last_name=REMOVED_STAFF_MARK).order_by('name')
        return Response(UserSerializer(staff, many=True).data)

    def post(self, request):
        serializer = StaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            courier = User.objects.create_user(**serializer.validated_data, role=self.role)
        except IntegrityError:
            raise serializers.ValidationError({'email': 'Этот email уже зарегистрирован.'})
        if self.role == 'COURIER':
            with transaction.atomic():
                dispatch_waiting_orders()
        return Response(UserSerializer(courier).data, status=201)

def staff_profile(user):
    """What the administrator sees when opening a staff member: personal data and a summary of their work."""
    from decimal import Decimal
    from django.db.models import Count, Sum
    from .models import Order, Payment, StatusHistory
    received = Payment.objects.filter(paid_by=user).aggregate(total=Sum('amount'), count=Count('id'))
    stats = {'payments_count': received['count'], 'payments_total': format(received['total'] or Decimal('0'), '.2f')}
    if user.role == 'COURIER':
        deliveries = Order.objects.filter(courier=user)
        stats.update(delivered=deliveries.filter(status='DELIVERED').count(),
                     active=deliveries.exclude(status__in=('DELIVERED', 'CANCELLED')).count(),
                     open_debts=deliveries.filter(status='DELIVERED', on_credit=True, payment__isnull=True).count())
    elif user.role == 'PASTRY':
        moves = StatusHistory.objects.filter(actor=user)
        stats.update(confirmed=moves.filter(to_status='CONFIRMED').count(), cooked=moves.filter(to_status='READY').count())
    return {**UserSerializer(user).data, 'date_joined': user.date_joined, 'last_login': user.last_login, 'stats': stats}

class AdminCourier(generics.UpdateAPIView, generics.DestroyAPIView):
    permission_classes = [IsAdmin]
    queryset = User.objects.filter(role='COURIER').exclude(last_name=REMOVED_STAFF_MARK)
    serializer_class = CourierUpdateSerializer
    http_method_names = ['get', 'patch', 'delete', 'options']

    def get(self, request, *args, **kwargs):
        return Response(staff_profile(self.get_object()))

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """Remove a staff member from the team while orders, history and receipts keep their name and phone.

        The row stays (orders and payments point at it), but the account can no longer sign in, disappears
        from the staff lists and frees its email for a new account. A courier's unfinished orders move to others.
        """
        user = User.objects.select_for_update().get(pk=self.get_object().pk)
        user.first_name = user.email  # the original login, kept for the record
        user.email = f'removed-{user.pk}-{user.email}'
        user.last_name = REMOVED_STAFF_MARK
        user.is_active = False
        user.set_unusable_password()  # also ends every open session of this account
        user.save(update_fields=['first_name', 'email', 'last_name', 'is_active', 'password'])
        moved = waiting = 0
        if user.role == 'COURIER':
            # Only after the account is closed: otherwise dispatch would see this courier as free and hand the orders back.
            moved, waiting = release_courier_orders(user)
        return Response({'detail': 'Сотрудник удалён из команды.', 'moved_orders': moved, 'waiting_orders': waiting})

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if user.role == 'COURIER' and user.is_active:
            with transaction.atomic():
                dispatch_waiting_orders()
        return Response(UserSerializer(user).data)

class AdminCourierPassword(APIView):
    """The administrator gives a staff member a new password. Passwords are stored only as hashes, so the old one
    cannot be shown; the new one is set here and every open session of that account ends."""
    permission_classes = [IsAdmin]
    queryset = AdminCourier.queryset

    @transaction.atomic
    def post(self, request, pk):
        user = get_object_or_404(self.queryset.select_for_update(), pk=pk)
        password = serializers.CharField(max_length=128, trim_whitespace=False).run_validation(request.data.get('password'))
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Пароль изменён. Передайте новый пароль сотруднику.'})

class AdminCashiers(AdminCouriers):
    role = 'CASHIER'

class AdminCashier(AdminCourier):
    queryset = User.objects.filter(role='CASHIER').exclude(last_name=REMOVED_STAFF_MARK)

class AdminCashierPassword(AdminCourierPassword):
    queryset = AdminCashier.queryset

class AdminPastryChefs(AdminCouriers):
    role = 'PASTRY'

class AdminPastryChef(AdminCourier):
    queryset = User.objects.filter(role='PASTRY').exclude(last_name=REMOVED_STAFF_MARK)

class AdminPastryChefPassword(AdminCourierPassword):
    queryset = AdminPastryChef.queryset

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
