# CampusConnect — Smart Campus Lost & Found

Responsive single-page frontend using HTML, CSS, Bootstrap and JavaScript Fetch API. Backend uses Node.js, Express and MongoDB/Mongoose.

## Run on Windows
1. Make sure the MongoDB Windows service is running.
2. Double-click `start.bat` from this folder, or run `npm install` and `npm run dev` in a terminal here.
3. Open http://localhost:5000. Keep the terminal open while using the site.

The first run copies `.env.example` to `.env`. For local development, the default URI is `mongodb://127.0.0.1:27017/campusconnect`. Change `JWT_SECRET` in `.env` to a long random value before using/deploying beyond local testing.

## MongoDB and Postman
- MongoDB is the database; Mongoose connects the Express backend to it.
- Postman does not connect directly to MongoDB. It sends HTTP requests to the backend API to test the database-backed operations.
- Import `docs/CampusConnect.postman_collection.json` into Postman.
- Start the server, then send `GET http://localhost:5000/api/health`. Expected response contains `"database":"connected"`.
- Send Register, then Login. The collection automatically saves the returned JWT token when the request succeeds. Use that token for protected routes.
- Change the demo email/password in the collection if the email already exists. Registration returns 409 for an existing email.

## Main endpoints
- `GET /api/health` — API and DB status
- `POST /api/auth/register` — `{ "name": "Demo Student", "email": "demo@example.com", "password": "Campus123" }`
- `POST /api/auth/login` — `{ "email": "demo@example.com", "password": "Campus123" }`
- `GET /api/auth/me` — Bearer token required
- `GET /api/items` — list/search/filter items
- `GET /api/items/mine` — Bearer token required
- `POST /api/items` — Bearer token required
- `PATCH /api/items/:id` — Bearer token required, owner only
- `DELETE /api/items/:id` — Bearer token required, owner only

## Security notes
This is a local college project starter, not production-hardened. Do not commit `.env`; use a unique JWT secret and HTTPS/appropriate CORS/rate limits before deployment. Never use a real password in screenshots or shared Postman collections.
