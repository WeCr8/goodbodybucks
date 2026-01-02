FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app files
COPY app.py .
COPY serviceAccountKey.json .

# Set port (Cloud Run uses PORT env var)
ENV PORT=8080
EXPOSE 8080

# Run app
CMD ["python", "app.py"]

