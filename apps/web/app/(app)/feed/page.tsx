const mockFeed = [
  { id: '1', dish: 'Kapsalon', place: 'Snackpoint Centrum', rating: 5, text: 'Top portie, perfect gekruid.' },
  { id: '2', dish: 'Frikandel Speciaal', place: 'De Hoek', rating: 4, text: 'Goede sausverdeling en krokant broodje.' }
];

export default function FeedPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Nieuwste reviews</h1>
      {mockFeed.map((item) => (
        <article key={item.id} className="rounded-xl border p-4">
          <p className="text-sm text-zinc-500">{item.place}</p>
          <h2 className="font-semibold">{item.dish} · {item.rating}/5</h2>
          <p className="mt-2 text-sm">{item.text}</p>
        </article>
      ))}
      <div className="rounded-xl border border-dashed p-4 text-sm text-zinc-500">Loading state: skeleton cards bij fetch volgende pagina.</div>
      <div className="rounded-xl border border-dashed p-4 text-sm text-zinc-500">Empty state: nog geen reviews in jouw regio.</div>
      <div className="rounded-xl border border-dashed p-4 text-sm text-zinc-500">Error state: laden mislukt, probeer opnieuw.</div>
    </div>
  );
}
