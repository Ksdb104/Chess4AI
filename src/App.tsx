import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { ChessGame } from './pages/ChessGame';
import { XiangqiGame } from './pages/XiangqiGame';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chess" element={<ChessGame />} />
          <Route path="/xiangqi" element={<XiangqiGame />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
