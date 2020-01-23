import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'

interface ConnectionToken {
  secret: string
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'https://cap-stripe-terminal-example.herokuapp.com'

  constructor(private http: HttpClient) {}

  async fetchConnectionToken() {
    console.log('fetchConnectionToken')
    const response: ConnectionToken = await this.http
      .post<ConnectionToken>(`${this.baseUrl}/connection_token`, {})
      .toPromise()

    const secret = response && response.secret

    if (!secret) {
      throw new Error('Failed to decode connection token')
    }
    console.log('gotConnectionToken', secret)

    return secret
  }
}
