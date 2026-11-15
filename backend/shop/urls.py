from django.urls import path
from . import auth_views as auth
from . import catalog_views as catalog
from . import order_views as orders
from . import staff_views as staff
from . import upload_views as uploads

urlpatterns = [
    path('health/', catalog.Health.as_view()),
    path('auth/csrf/', auth.CsrfView.as_view()),
    path('auth/register/', auth.RegisterView.as_view()),
    path('auth/login/', auth.LoginView.as_view()),
    path('auth/logout/', auth.LogoutView.as_view()),
    path('auth/me/', auth.MeView.as_view()),
    path('auth/profile/', auth.ProfileView.as_view()),
    path('auth/password-reset/', auth.PasswordResetView.as_view()),
    path('auth/password-reset-confirm/', auth.PasswordResetConfirmView.as_view()),
    path('categories/', catalog.Categories.as_view()),
    path('products/', catalog.Products.as_view()),
    path('products/<int:pk>/', catalog.ProductDetail.as_view()),
    path('settings/', catalog.StoreSettings.as_view()),
    path('admin/uploads/product-image/', uploads.ProductImageUpload.as_view()),
    path('admin/categories/', catalog.AdminCategories.as_view()),
    path('admin/categories/<int:pk>/', catalog.AdminCategory.as_view()),
    path('admin/products/', catalog.AdminProducts.as_view()),
    path('admin/products/<int:pk>/', catalog.AdminProduct.as_view()),
    path('admin/couriers/', catalog.AdminCouriers.as_view()),
    path('admin/couriers/<int:pk>/', catalog.AdminCourier.as_view()),
    path('admin/cashiers/', catalog.AdminCashiers.as_view()),
    path('admin/cashiers/<int:pk>/', catalog.AdminCashier.as_view()),
    path('admin/businesses/', catalog.AdminBusinesses.as_view()),
    path('admin/businesses/<int:pk>/', catalog.AdminBusiness.as_view()),
    path('courier/available-orders/', staff.AvailableOrders.as_view()),
    path('courier/team-orders/', staff.TeamOrders.as_view()),
    path('admin/overview/', staff.AdminOverview.as_view()),
    path('cashier/summary/', staff.CashierSummary.as_view()),
    path('orders/', orders.Orders.as_view()),
    path('orders/<int:pk>/', orders.OrderDetail.as_view()),
    path('orders/<int:pk>/transition/', orders.Transition.as_view()),
    path('orders/<int:pk>/assign/', orders.Assign.as_view()),
    path('orders/<int:pk>/cancel/', orders.CustomerCancel.as_view()),
    path('orders/<int:pk>/problem/', orders.ReportProblem.as_view()),
    path('orders/<int:pk>/claim/', staff.ClaimOrder.as_view()),
    path('orders/<int:pk>/transfer/', staff.TransferOrder.as_view()),
    path('orders/<int:pk>/payment/', staff.ReceivePayment.as_view()),
]
