from rest_framework.pagination import PageNumberPagination


class BoundedPageNumberPagination(PageNumberPagination):
    """Pages are opt-in: without ?page_size the response keeps its plain list shape.

    With ?page_size the value is capped at max_page_size, so no request can ask for the whole table.
    """
    page_size = None
    page_size_query_param = 'page_size'
    max_page_size = 100
