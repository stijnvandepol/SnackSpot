const steps = [
  '1) Kies locatie',
  '2) Kies of maak place',
  '3) Voeg snack/meal toe',
  '4) Score + subscores',
  '5) Schrijf reviewtekst',
  '6) Upload foto\'s (1–6)',
  '7) Preview + posten'
];

export default function AddReviewPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Add Review</h1>
      <p className="text-sm text-zinc-600">Stapsgewijze flow met validatie per stap en concept-opslag.</p>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step} className="rounded-xl border p-3 text-sm">{step}</li>
        ))}
      </ol>
      <div className="flex gap-2">
        <button className="rounded-lg border px-4 py-2 text-sm">Vorige</button>
        <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">Volgende</button>
      </div>
    </div>
  );
}
