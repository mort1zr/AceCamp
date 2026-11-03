export default function PageStub({ title, note }) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-4 text-text2">{note}</p>
    </div>
  )
}
