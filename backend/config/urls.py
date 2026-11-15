from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

urlpatterns = [path('api/', include('shop.urls'))]
# Photos uploaded during local development (see LOCAL_UPLOAD_DIR); static() adds nothing unless DEBUG is on.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
