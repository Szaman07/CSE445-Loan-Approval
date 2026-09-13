# CSE445 Loan Approval

A loan approval classification project built with scikit-learn, FastAPI, and React.

The model uses a fixed train, validation, and test split. Preprocessing is fitted inside the scikit-learn pipeline, and the classification threshold is selected on validation data before final test evaluation.

## Results

| Test metric | Score |
|---|---:|
| F1 | 0.6844 |
| Precision | 0.5619 |
| Recall | 0.8753 |
| Average precision | 0.6865 |
| ROC AUC | 0.7852 |

Model: class-balanced L1 logistic regression with `C=0.3` and a validation-selected threshold of `0.447`.

## Features

- Dataset exploration with distributions, relationships, group comparisons, and missing-value summaries
- Baseline and scenario comparison using 15 model inputs
- Reproducible training and saved model metadata
- FastAPI prediction and dataset endpoints
- React and TypeScript frontend
- Automated backend and frontend tests

## Project structure

```text
api/                FastAPI application
src/creditwise/     data processing, training, inference, and exploration
tests/              Python tests
web/                React frontend
docs/               architecture, model card, and experiment notes
data/                source dataset
```

## Run locally

Requires Python 3.11 or 3.12 and Node.js 20 or later.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
.venv\Scripts\python.exe -m creditwise.training
.venv\Scripts\python.exe -m uvicorn api.main:app --reload
```

In another terminal:

```powershell
cd web
npm ci
npm run dev
```

The frontend runs at `http://127.0.0.1:5173` and the API at `http://127.0.0.1:8000`.

## Tests

```powershell
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m pytest -q
cd web
npm run lint
npm test
npm run build
```

## Deployment

- `render.yaml` and `Dockerfile` configure the FastAPI backend.
- `web/vercel.json` configures the frontend.
- Set `VITE_API_BASE_URL` to the backend URL and `CORS_ORIGINS` to the frontend domain.

See [Architecture](docs/ARCHITECTURE.md), [Model card](docs/MODEL_CARD.md), [generated diagnostics](docs/MODEL_DIAGNOSTICS.md), and [Experiments](docs/EXPERIMENTS.md) for details. The diagnostics reproduce the fixed test split and document threshold tradeoffs, calibration, coefficient interpretation, error slices, and limits on the claims.

## License

MIT

