FROM python:3.12-slim
WORKDIR /app

# System deps for pdfplumber / Levenshtein wheels.
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The app is imported as `backend.main`, so copy into /app/backend.
COPY . /app/backend
ENV PYTHONPATH=/app

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
