FROM node:20.0-alpine AS build

# Get access to pnpm
RUN corepack enable

# Change directory to /bot
WORKDIR /bot

# Copy files required to install dependencies
COPY package.json pnpm-lock.yaml tsconfig.json ./

# Install dependencies
RUN pnpm install

# COPY src folder
COPY /src ./src

# Build project to dist
RUN pnpm run build

# # Remove all dev dependencies
RUN pnpm prune --prod


FROM node:20.0-alpine

# Get access to pnpm
RUN corepack enable

# Go inside the app directory
WORKDIR /bot

# Copy built files that are necessary
COPY --from=build /bot/dist ./dist
COPY --from=build /bot/node_modules ./node_modules
COPY package.json .

# Run the build
CMD [ "pnpm", "run", "start" ]