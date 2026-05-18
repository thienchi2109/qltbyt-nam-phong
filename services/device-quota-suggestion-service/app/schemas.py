from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class DeviceNameItem(BaseModel):
    name: str = Field(min_length=1)
    deviceIds: List[int] = Field(default_factory=list)

    @field_validator("deviceIds")
    @classmethod
    def device_ids_must_be_positive(cls, value: List[int]) -> List[int]:
        if any(item <= 0 for item in value):
            raise ValueError("deviceIds must contain positive integers")
        return value


class CategoryItem(BaseModel):
    id: int = Field(gt=0)
    code: Optional[str] = None
    name: str = Field(min_length=1)
    classification: Optional[str] = None


class SuggestOptions(BaseModel):
    topK: int = Field(default=3, ge=1, le=10)
    semanticWeight: float = Field(default=1.0, ge=0.0)
    lexicalWeight: float = Field(default=1.0, ge=0.0)
    minConfidence: float = Field(default=0.62, ge=0.0, le=1.0)
    minMargin: float = Field(default=0.04, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def at_least_one_weight(self) -> "SuggestOptions":
        if self.semanticWeight == 0 and self.lexicalWeight == 0:
            raise ValueError("at least one ranking weight must be positive")
        return self


class SuggestRequest(BaseModel):
    requestId: str = Field(min_length=1)
    facilityId: int = Field(gt=0)
    catalogSignature: str = Field(min_length=1)
    unassignedSignature: str = Field(min_length=1)
    deviceNames: List[DeviceNameItem] = Field(min_length=1)
    categories: List[CategoryItem] = Field(min_length=1)
    options: SuggestOptions = Field(default_factory=SuggestOptions)


ResponseDict = Dict[str, Any]
