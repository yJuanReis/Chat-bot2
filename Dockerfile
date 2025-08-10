#
# SPDX-FileCopyrightText: Hadad <hadad@linuxmail.org>
# SPDX-License-Identifier: Apache-2.0
#

# Use a specific container image for the sever
FROM hadadrjt/ai:latest

# Set the main working directory inside the container
WORKDIR /node

# Copy all files into the container
COPY . .

# Install all dependencies
RUN npm install

# Open the port so the web can be accessed
EXPOSE 7860

# Start the server
CMD ["npm", "start"]