FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create uploads directory for comprobantes
RUN mkdir -p /app/uploads/comprobantes

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8005", "--reload"]
