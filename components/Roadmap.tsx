const stages = [
  {
    phase: 'NOW',
    text: 'Typing lab, baseline and comparison experiment, two-person challenge, and a synthetic experiment report. Free to explore today.',
  },
  {
    phase: 'NEXT',
    text: 'A developer-facing API pilot, expanded timing features, and testing with real participants beyond synthetic samples.',
  },
  {
    phase: 'LATER',
    text: 'Integration with login flows as an extra signal, with privacy and retention reviewed before any deployment.',
  },
];

export default function Roadmap() {
  return (
    <section className="roadmap-section" id="roadmap" aria-labelledby="roadmap-title">
      <div className="roadmap-heading">
        <div>
          <span className="eyebrow">03 / Room to grow</span>
          <h2 id="roadmap-title">Start with curiosity.<br/>Build with confidence.</h2>
        </div>
        <p>Finomaly is a research prototype.<br className="desktop-break"/>Here&apos;s where it is today and where it could go.</p>
      </div>
      <div className="roadmap-grid">
        {stages.map((stage) => (
          <article className="roadmap-card" key={stage.phase}>
            <h3>{stage.phase}</h3>
            <p>{stage.text}</p>
          </article>
        ))}
      </div>
      <div className="roadmap-strip">
        <span>Interested in piloting this?</span>
        <a href="mailto:ncharvi02@gmail.com,vasu85730@gmail.com?subject=Finomaly%20Pilot%20Inquiry" className="btn btn-secondary">Get in touch →</a>
      </div>
    </section>
  );
}
