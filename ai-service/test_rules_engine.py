import unittest
from datetime import datetime, timezone, timedelta
from rules_engine import evaluate_asset_health

class TestRulesEngine(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.base_asset = {
            "name": "Chiller Alpha",
            "type": "HVAC",
            "department": "HVAC",
            "maintenanceIntervalDays": 60,
            "lastServicedDate": (self.now - timedelta(days=20)).isoformat(),
        }

    def generate_normal_readings(self, days=35, daily_hours=8.0, base_runtime=1000.0, temp=40.0):
        readings = []
        runtime = base_runtime
        for d in range(days, -1, -1):
            ts = self.now - timedelta(days=d)
            runtime += daily_hours
            readings.append({
                "timestamp": ts.isoformat(),
                "temperature": temp,
                "runtimeHours": runtime,
                "errorCode": None,
            })
        return readings

    def test_healthy_baseline(self):
        readings = self.generate_normal_readings()
        result = evaluate_asset_health(self.base_asset, readings, current_time=self.now)
        self.assertEqual(result["status"], "Healthy")
        self.assertEqual(len(result["reasons"]), 0)
        self.assertIn("operating normally", result["summary"])

    def test_rule_1_runtime_deviation_watch(self):
        # 30-day baseline ~8 hrs/day. In the last 7 days, runtime increases by 35% (>25% but <50%)
        readings = []
        runtime = 1000.0
        for d in range(35, -1, -1):
            ts = self.now - timedelta(days=d)
            hrs = 8.0 if d > 7 else (8.0 * 1.35)
            runtime += hrs
            readings.append({
                "timestamp": ts.isoformat(),
                "temperature": 40.0,
                "runtimeHours": runtime,
                "errorCode": None,
            })
        result = evaluate_asset_health(self.base_asset, readings, current_time=self.now)
        self.assertEqual(result["status"], "Watch")
        self.assertIn("runtime_deviation", result["reasons"])
        self.assertIn("above the 30-day daily average", result["summary"])

    def test_rule_1_runtime_deviation_critical(self):
        # Last 7 days runtime increases by 60% (>50%)
        readings = []
        runtime = 1000.0
        for d in range(35, -1, -1):
            ts = self.now - timedelta(days=d)
            hrs = 8.0 if d > 7 else (8.0 * 1.60)
            runtime += hrs
            readings.append({
                "timestamp": ts.isoformat(),
                "temperature": 40.0,
                "runtimeHours": runtime,
                "errorCode": None,
            })
        result = evaluate_asset_health(self.base_asset, readings, current_time=self.now)
        self.assertEqual(result["status"], "Critical")
        self.assertIn("runtime_deviation_severe", result["reasons"])

    def test_rule_2_recent_error_code(self):
        readings = self.generate_normal_readings()
        # Add error code 24 hours ago
        readings[-2]["errorCode"] = "E_PRESSURE_LOSS_01"
        result = evaluate_asset_health(self.base_asset, readings, current_time=self.now)
        self.assertEqual(result["status"], "Critical")
        self.assertIn("recent_error", result["reasons"])
        self.assertIn("E_PRESSURE_LOSS_01", result["summary"])

    def test_rule_3_maintenance_overdue_watch_and_critical(self):
        readings = self.generate_normal_readings()
        
        # 1. Overdue (>60 days, e.g. 70 days) -> Watch
        asset_watch = {**self.base_asset, "lastServicedDate": (self.now - timedelta(days=70)).isoformat()}
        result_watch = evaluate_asset_health(asset_watch, readings, current_time=self.now)
        self.assertEqual(result_watch["status"], "Watch")
        self.assertIn("maintenance_overdue", result_watch["reasons"])

        # 2. Severely overdue (>1.5 * 60 = 90 days, e.g. 100 days) -> Critical
        asset_crit = {**self.base_asset, "lastServicedDate": (self.now - timedelta(days=100)).isoformat()}
        result_crit = evaluate_asset_health(asset_crit, readings, current_time=self.now)
        self.assertEqual(result_crit["status"], "Critical")
        self.assertIn("maintenance_severely_overdue", result_crit["reasons"])

    def test_rule_4_temperature_threshold(self):
        readings = self.generate_normal_readings()
        # Safe threshold for HVAC is 50.0°C. Reading at 58.0°C
        readings[-1]["temperature"] = 58.0
        result = evaluate_asset_health(self.base_asset, readings, current_time=self.now)
        self.assertEqual(result["status"], "Critical")
        self.assertIn("temperature_exceeded", result["reasons"])
        self.assertIn("58.0°C", result["summary"])

    def test_spec_criterion_different_maintenance_schedules(self):
        # "Given two assets with identical raw readings but different maintenanceIntervalDays / lastServicedDate,
        # their computed status can legitimately differ"
        readings = self.generate_normal_readings()
        asset_recent_service = {
            "name": "HVAC 1",
            "type": "HVAC",
            "maintenanceIntervalDays": 60,
            "lastServicedDate": (self.now - timedelta(days=15)).isoformat(),
        }
        asset_overdue_service = {
            "name": "HVAC 2",
            "type": "HVAC",
            "maintenanceIntervalDays": 60,
            "lastServicedDate": (self.now - timedelta(days=95)).isoformat(),
        }

        res1 = evaluate_asset_health(asset_recent_service, readings, current_time=self.now)
        res2 = evaluate_asset_health(asset_overdue_service, readings, current_time=self.now)

        self.assertEqual(res1["status"], "Healthy")
        self.assertEqual(res2["status"], "Critical")
        self.assertNotEqual(res1["status"], res2["status"])

    def test_highest_severity_resolution(self):
        # Asset with Watch condition (maintenance overdue) AND Critical condition (temperature exceeded)
        # Final status MUST be Critical
        readings = self.generate_normal_readings()
        readings[-1]["temperature"] = 62.0 # Critical
        asset = {
            "name": "HVAC Combined",
            "type": "HVAC",
            "maintenanceIntervalDays": 60,
            "lastServicedDate": (self.now - timedelta(days=70)).isoformat(), # Watch
        }
        result = evaluate_asset_health(asset, readings, current_time=self.now)
        self.assertEqual(result["status"], "Critical")
        self.assertIn("maintenance_overdue", result["reasons"])
        self.assertIn("temperature_exceeded", result["reasons"])

if __name__ == "__main__":
    unittest.main()
