#
# SPDX-FileCopyrightText: Hadad <hadad@linuxmail.org>
# SPDX-License-Identifier: MIT
#

# Use a specific container image for the application
FROM hadadrjt/ai:latest

# Set the main working directory inside the container
WORKDIR /app/backend

# Copy the database file into the container
COPY --chown=$UID:$GID webui.db /app/backend/data/

# Set the database file to read-only
# to prevent unauthorized changes and improve security.
# This database is a placeholder or dummy,
# and the core configuration is located in the Environment
# and Secret Environment settings of Hugging Face Spaces.
RUN chmod 555 /app/backend/data/webui.db

# Search Engine Optimization (SEO)
# Robots Exclusion Protocol
RUN search='<meta name="robots" content="noindex,nofollow"' && \
    replace='<meta name="robots" content="index,follow"' && \
    find /app -type f -name '*.html' -exec grep -l "$search" {} \; | \
    while IFS= read -r file; do \
        echo "Processing: $file" && \
        if sed -i "s|$search|$replace|g" "$file"; then \
            echo "Success: $file updated"; \
        else \
            echo "Error: failed to update $file"; \
            exit 1; \
        fi; \
    done
# https://umint-ai.hf.space/robots.txt
COPY --chown=$UID:$GID robots.txt /app/build/
# Sitemaps
# https://umint-ai.hf.space/sitemap.xml
COPY --chown=$UID:$GID sitemap.xml /app/build/
# Google Search Console Tools
# https://umint-ai.hf.space/google15aba15fe250d693.html
COPY --chown=$UID:$GID google15aba15fe250d693.html /app/build/
# Bing Webmaster Tools
# https://umint-ai.hf.space/BingSiteAuth.xml
COPY --chown=$UID:$GID BingSiteAuth.xml /app/build/

# Open the port so the application can be accessed
EXPOSE 8000

# Start the application using the startup script
CMD ["bash", "start.sh"]