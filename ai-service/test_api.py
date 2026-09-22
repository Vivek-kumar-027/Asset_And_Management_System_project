import unittest
from fastapi.testclient import TestClient
from main import app
from datetime import datetime, timezone, timedelta

client = TestClient(app)

class TestFastAPIService(unittest.TestCase):
    def test_health_check(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")

    def test_analyze_endpoint(self):
        now = datetime.now(timezone.utc)
        payload = {
            "asset": {
                "name": "Generator East Wing",
                "type": "Generator",
                "department": "Electrical",
                "maintenanceIntervalDays": 90,
                "lastServicedDate": (now - timedelta(days=30)).isoformat(),
            },
            "readings": [
                {
                    "timestamp": (now - timedelta(days=2)).isoformat(),
                    "temperature": 72.0,
                    "runtimeHours": 1200.0,
                    "errorCode": None,
                },
                {
                    "timestamp": (now - timedelta(days=1)).isoformat(),
                    "temperature": 89.5, # Exceeds generator threshold 85.0
                    "runtimeHours": 1210.0,
                    "errorCode": "ERR_TEMP_CRIT",
                },
            ],
        }

        response = client.post("/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "Critical")
        self.assertIn("recent_error", data["reasons"])
        self.assertIn("temperature_exceeded", data["reasons"])
        self.assertIn("Generator East Wing flagged as Critical", data["summary"])
        print("\n[OK] FastAPI /analyze returned expected response:", data["summary"])

if __name__ == "__main__":
    unittest.main()
