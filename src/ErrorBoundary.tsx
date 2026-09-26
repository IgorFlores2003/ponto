import { Component, type ErrorInfo, type ReactNode } from 'react'
import { FiAlertCircle } from 'react-icons/fi'

interface Props { children: ReactNode; fallbackLabel?: string }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  retry = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <FiAlertCircle className="size-10 text-red-500" />
          <div>
            <p className="font-semibold text-red-700">
              {this.props.fallbackLabel ?? 'Algo deu errado ao renderizar esta seção.'}
            </p>
            <p className="mt-1 text-sm text-red-500">{this.state.error.message}</p>
          </div>
          <button
            onClick={this.retry}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
