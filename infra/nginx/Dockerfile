FROM nginx:1.27-alpine

# Install headers-more module so we can override Vary headers that
# Next.js hardcodes on API responses (prevents Cloudflare from caching).
RUN apk add --no-cache nginx-mod-http-headers-more

# Load the module in the main config (conf.d files can't use load_module)
RUN sed -i '1i load_module modules/ngx_http_headers_more_filter_module.so;' /etc/nginx/nginx.conf
