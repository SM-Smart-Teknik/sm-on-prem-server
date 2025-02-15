# SM On-Prem Server 🖥️

An automated server application that synchronizes work orders from Next Project to Microsoft Outlook calendars.

## Features ✨

- Real-time work order synchronization
- Automated calendar event management
- User-specific calendar assignments
- Web-based monitoring dashboard
- Live logging system
- Manual sync trigger option
- Health check monitoring

## Prerequisites 📋

- Docker Desktop
- Microsoft Azure account with appropriate permissions
- Next Project account credentials

## Environment Variables 🔐

Create a `.env` file in the root directory:

```env
# Next Project Credentials
NEXT_USERNAME=your_username
NEXT_PASSWORD=your_password

# Microsoft Graph API
TENANT_ID=your_tenant_id
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret

# Server Configuration
PORT=3000
```

## Installation 💻

```bash
# Clone the repository
git clone https://github.com/yourusername/sm-on-prem-server.git

# Navigate to project directory
cd sm-on-prem-server

# Create environment file
copy .env.example .env

# Build and start with Docker
docker-compose up -d

# View logs
docker-compose logs -f
```

## Installation 💻

```bash
# For development (foreground):
docker-compose up

# For production (background):
docker-compose up -d
docker-compose logs -f  # View logs separately
```

> 💡 **Tip:** Use `docker-compose up` during development for direct log viewing, and `docker-compose up -d` in production for background operation.
