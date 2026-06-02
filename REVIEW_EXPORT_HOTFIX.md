# Quiet Progress v1.3.5.1 — Review Export Hotfix

## Correção

O frontend já continha o card `Review & Export`, mas o backend não tinha as rotas:

```text
GET /api/reviews/day/:date
GET /api/reviews/week/:date
GET /api/reviews/month/:month
```

Este hotfix adiciona:

```text
buildReviewDay()
buildReviewWeek()
buildReviewMonth()
getFocusRangeSummary()
rotas /api/reviews/*
compatibilidade do endpoint antigo /api/week/:date/review
```

## Mantido

```text
Habit Matrix
Backup/restore
PM2
Web Push
End Day
Journal
Build/Reduction
Scores/streaks/logs
```

## Teste recomendado

```bash
npm run check
pm2 restart quiet-progress --update-env
curl -i http://127.0.0.1:3000/api/reviews/day/2026-06-02
```

O `curl` sem cookie deve retornar 401. Pelo navegador logado deve retornar JSON.
