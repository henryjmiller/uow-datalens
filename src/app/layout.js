import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "uow-datalens",
  description: "",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            <Link href="/">Home</Link>
            {" "}
            <Link href="/datasets">Datasets</Link>
            {" "}
            <Link href="/analysis">Analysis</Link>
            {" "}
            <Link href="/predictive-modelling">Predictive Modelling</Link>
            {" "}
            <Link href="/visualisations">Visualisations</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
