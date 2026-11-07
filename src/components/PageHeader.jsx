
function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-4xl text-aspal-950">{title}</h1>
        <p className="mt-1 text-sm text-aspal-600">{description}</p>
      </div>

      {action}
    </div>
  )
}

export default PageHeader
