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

# Open the port so the application can be accessed
EXPOSE 7860

# Start the application using the startup script
CMD ["bash", "start.sh"]