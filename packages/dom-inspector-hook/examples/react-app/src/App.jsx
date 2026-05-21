export default function App() {
  return (
    <div style={{ padding: 40 }}>
      <h1>React Inspector Hook Test</h1>
      <p>按 Alt+Shift 点击元素，触发 capture POST</p>

      <Card title="Card A">
        <p>Card A content</p>
      </Card>

      <Card title="Card B">
        <button onClick={() => alert('clicked')}>Click Me</button>
      </Card>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ border: '1px solid #ccc', padding: 16, margin: '16px 0', borderRadius: 8 }}>
      <h2>{title}</h2>
      {children}
    </div>
  )
}
