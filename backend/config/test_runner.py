from decimal import Decimal

from django.conf import settings
from django.test.runner import DiscoverRunner


class FixedFeeRunner(DiscoverRunner):
    """Tests exercise the delivery-fee check with a non-zero fee, whatever DELIVERY_FEE the local .env or the host sets."""

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        settings.DELIVERY_FEE = Decimal('1500.00')
