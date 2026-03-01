class PrintRequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        print(f"[REQ] method={request.method} path={request.path} full={request.get_full_path()}")
        response = self.get_response(request)
        print(f"[RES] status={response.status_code} path={request.path}")
        return response