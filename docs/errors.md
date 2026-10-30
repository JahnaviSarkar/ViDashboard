# ViDashboard - Error Handling Reference

All errors conform to the standard error structure:
```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable description of error",
    "details": {},
    "retryable": false
  }
}
```

## Standard Error Codes
- `VALIDATION_ERROR`: Input parameters failed Zod validation (retryable: false)
- `NOT_FOUND`: Resource (search, event, video) not found (retryable: false)
- `SSRF_ATTEMPT_DETECTED`: Provided URL attempted loopback/private IP access (retryable: false)
- `URL_RESOLVE_FAILED`: Product webpage could not be fetched or parsed (retryable: true)
- `IMAGE_ANALYSIS_FAILED`: Vision provider error (retryable: true)
- `COLLECTOR_TIMEOUT`: Social provider timed out (retryable: true)
- `DATABASE_ERROR`: Database query or connection failure (retryable: true)
- `INTERNAL_SERVER_ERROR`: Unhandled system error (retryable: false)
