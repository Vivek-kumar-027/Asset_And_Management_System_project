from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from rules_engine import evaluate_asset_health

app = FastAPI(
    title="Asset AI Analysis Service",
    description="Explainable rule-based operational health analysis for facility assets",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AssetPayload(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    department: str
    installedDate: Optional[str] = None
    maintenanceIntervalDays: int = 90
    lastServicedDate: Optional[str] = None

class ReadingPayload(BaseModel):
    timestamp: str
    temperature: Optional[float] = None
    runtimeHours: float
    errorCode: Optional[str] = None

class AnalysisRequest(BaseModel):
    asset: AssetPayload
    readings: List[ReadingPayload]
    custom_temp_thresholds: Optional[Dict[str, float]] = None

class AnalysisResponse(BaseModel):
    status: str
    reasons: List[str]
    summary: str
    rule_explanations: List[str]

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Asset AI Analysis Service"}

@app.post("/analyze", response_model=AnalysisResponse)
def analyze_asset(payload: AnalysisRequest):
    try:
        result = evaluate_asset_health(
            asset=payload.asset.model_dump(),
            readings=[r.model_dump() for r in payload.readings],
            custom_temp_thresholds=payload.custom_temp_thresholds,
        )
        return AnalysisResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
