Multi_Tenant Project

## Deployment

The production Docker image serves the React app, API, and Socket.io from the
same origin. On Render's free tier, the service may spin down after inactivity;
the first visit after a quiet period can take about a minute while it starts.