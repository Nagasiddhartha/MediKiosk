from datetime import date, datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, computed_field


class PatientProfileCreate(BaseModel):
    full_name: str | None = None
    date_of_birth: date | None = None
    sex: str | None = Field(default=None, validation_alias=AliasChoices("sex", "biological_sex"))
    blood_group: str | None = Field(default=None, validation_alias=AliasChoices("blood_group", "blood_type"))
    height_cm: float | None = None
    weight_kg: float | None = None
    emergency_contact_name: str | None = Field(default=None, validation_alias=AliasChoices("emergency_contact_name", "emergency_contact"))
    emergency_contact_phone: str | None = None
    medical_notes: str | None = None


class PatientProfileUpdate(PatientProfileCreate):
    pass


class PatientProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str | None
    date_of_birth: date | None
    sex: str | None
    blood_group: str | None
    height_cm: float | None
    weight_kg: float | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    medical_notes: str | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def biological_sex(self) -> str | None:
        return self.sex

    @computed_field
    @property
    def blood_type(self) -> str | None:
        return self.blood_group

    @computed_field
    @property
    def emergency_contact(self) -> str | None:
        return self.emergency_contact_name


class ChronicConditionCreate(BaseModel):
    name: str = Field(validation_alias=AliasChoices("name", "condition_name"))
    diagnosed_date: date | None = Field(default=None, validation_alias=AliasChoices("diagnosed_date", "diagnosed_at"))
    status: str = "active"
    notes: str | None = None


class ChronicConditionUpdate(BaseModel):
    name: str | None = Field(default=None, validation_alias=AliasChoices("name", "condition_name"))
    diagnosed_date: date | None = Field(default=None, validation_alias=AliasChoices("diagnosed_date", "diagnosed_at"))
    status: str | None = None
    notes: str | None = None


class ChronicConditionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    diagnosed_date: date | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class AllergyCreate(BaseModel):
    allergen: str
    severity: str = "moderate"
    reaction_type: str | None = None
    notes: str | None = None


class AllergyUpdate(BaseModel):
    allergen: str | None = None
    severity: str | None = None
    reaction_type: str | None = None
    notes: str | None = None


class AllergyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    allergen: str
    severity: str
    reaction_type: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class MedicationCreate(BaseModel):
    drug_name: str = Field(validation_alias=AliasChoices("drug_name", "name"))
    dosage: str | None = None
    frequency: str | None = None
    route: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool = True
    prescriber: str | None = Field(default=None, validation_alias=AliasChoices("prescriber", "prescribed_by"))
    notes: str | None = None


class MedicationUpdate(BaseModel):
    drug_name: str | None = Field(default=None, validation_alias=AliasChoices("drug_name", "name"))
    dosage: str | None = None
    frequency: str | None = None
    route: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    prescriber: str | None = Field(default=None, validation_alias=AliasChoices("prescriber", "prescribed_by"))
    notes: str | None = None


class MedicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    drug_name: str
    dosage: str | None
    frequency: str | None
    route: str | None
    start_date: date | None
    end_date: date | None
    is_active: bool
    prescriber: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class VisitCreate(BaseModel):
    visit_date: date
    provider_name: str | None = None
    facility_name: str | None = None
    reason: str | None = None
    diagnosis: str | None = None
    notes: str | None = None


class VisitUpdate(BaseModel):
    visit_date: date | None = None
    provider_name: str | None = None
    facility_name: str | None = None
    reason: str | None = None
    diagnosis: str | None = None
    notes: str | None = None


class VisitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    visit_date: date
    provider_name: str | None
    facility_name: str | None
    reason: str | None
    diagnosis: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime