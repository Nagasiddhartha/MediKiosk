# MediKiosk

> 🚧 **Under Development**

**MediKiosk** is a privacy-first health web platform designed to help users organize their medical history, record symptoms, understand health documents, and generate structured summaries for doctor visits.

The goal is to turn scattered health information into a clear, longitudinal health record that users can control.

## 🎯 Problem

Medical information is often scattered across:

- Prescription and medical documents
- Lab reports
- Symptoms remembered only during appointments
- Health readings
- Previous diagnoses and medications

This makes it difficult for patients to maintain a complete medical history and communicate it clearly during consultations.

## 💡 Solution

MediKiosk provides a centralized personal health vault that allows users to:

- Record symptoms through structured intake
- Mark affected areas using a body map
- Upload medical documents
- Extract information from documents using OCR and AI
- Review and confirm extracted information
- Maintain a chronological health timeline
- Import health readings manually or through CSV
- Generate concise doctor-ready health summaries

## 🏗️ Planned Architecture

```text
                    MediKiosk Web App
                           |
                    Next.js / TypeScript
                           |
                    FastAPI Backend
                           |
             +-------------+-------------+
             |             |             |
        PostgreSQL       OCR/AI      Health Engine
             |             |             |
          pgvector      Tesseract      Rules
                           |
                       LLM API
