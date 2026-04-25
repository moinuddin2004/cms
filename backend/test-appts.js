const axios = require('axios');

async function test() {
  try {
    // 1. login to get token
    const loginRes = await axios.post('http://localhost:5000/auth/login', {
      email: 'admin@dentaflow.com',
      password: 'password123'
    });
    const token = loginRes.data.data.accessToken;
    const orgId = loginRes.data.data.user.organizationId;
    
    // 2. get locations
    const locRes = await axios.get('http://localhost:5000/locations', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const locId = locRes.data.data[0].id;
    
    // 3. get appointments
    const apptsRes = await axios.get('http://localhost:5000/appointments?limit=200', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': orgId,
        'x-location-id': locId
      }
    });
    console.log("Total appointments:", apptsRes.data.data.total);
    console.log("Appointments:", apptsRes.data.data.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
test();
