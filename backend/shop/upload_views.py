from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .image_upload import ImageUploadError, StorageNotConfigured, upload_product_image
from .security import IsAdmin


class ProductImageUpload(APIView):
    """Administrator uploads one product photo; the response carries the URL to save on the product."""
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser]

    def post(self, request):
        photo = request.FILES.get('file')
        if photo is None:
            return Response({'detail': 'Выберите файл с фотографией.'}, status=400)
        try:
            url = upload_product_image(photo.read())
        except ImageUploadError as error:
            return Response({'detail': str(error)}, status=400)
        except StorageNotConfigured:
            return Response({'detail': 'Загрузка фото не настроена на сервере. Сообщите администратору сайта.'}, status=503)
        return Response({'url': url}, status=201)
