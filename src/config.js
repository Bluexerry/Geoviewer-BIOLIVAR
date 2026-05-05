const ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const SENSOR_API_URL = process.env.REACT_APP_SENSOR_API_URL || 'http://localhost:5003';
const EE_API_URL = process.env.REACT_APP_EE_API_URL || 'http://localhost:5004';

export { ACCESS_TOKEN, API_URL, SENSOR_API_URL, EE_API_URL };
