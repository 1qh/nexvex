// biome-ignore-all lint/style/useConsistentMemberAccessibility: x
import type { Locator, Page } from '@playwright/test'

class MoviePage {
  protected readonly page: Page

  public constructor(page: Page) {
    this.page = page
  }

  public getSearchPage(): Locator {
    return this.page.getByTestId('movie-search-page')
  }

  public getSearchInput(): Locator {
    return this.page.getByTestId('movie-search-input')
  }

  public getSearchForm(): Locator {
    return this.page.getByTestId('movie-search-form')
  }

  public getMovieResults(): Locator {
    return this.page.getByTestId('movie-results')
  }

  public getMovieCards(): Locator {
    return this.page.locator('[data-testid="movie-card"]')
  }

  public getMovieTitle(): Locator {
    return this.page.getByTestId('movie-title').first()
  }

  public getFetchPage(): Locator {
    return this.page.getByTestId('movie-fetch-page')
  }

  public getFetchInput(): Locator {
    return this.page.getByTestId('movie-id-input')
  }

  public getFetchForm(): Locator {
    return this.page.getByTestId('movie-fetch-form')
  }

  public getMovieDetail(): Locator {
    return this.page.getByTestId('movie-detail')
  }

  public getCacheStatus(): Locator {
    return this.page.getByTestId('cache-status')
  }

  public getMovieLoading(): Locator {
    return this.page.getByTestId('movie-loading')
  }

  public getMovieError(): Locator {
    return this.page.getByTestId('movie-error')
  }

  public async gotoSearch(): Promise<void> {
    await this.page.goto('/movies')
    await this.page.waitForLoadState('networkidle')
  }

  public async gotoFetch(): Promise<void> {
    await this.page.goto('/movies/fetch')
    await this.page.waitForLoadState('networkidle')
  }

  public async searchMovie(query: string): Promise<void> {
    await this.getSearchInput().fill(query)
    await this.getSearchForm().locator('button[type="submit"], input').first().press('Enter')
  }

  public async fetchMovie(id: number): Promise<void> {
    await this.getFetchInput().fill(String(id))
    await this.getFetchForm().locator('button[type="submit"], input').first().press('Enter')
  }

  public getCacheTestPage(): Locator {
    return this.page.getByTestId('movie-cache-test-page')
  }

  public getCachedCount(): Locator {
    return this.page.getByTestId('cached-count')
  }

  public getCacheTmdbInput(): Locator {
    return this.page.getByTestId('cache-tmdb-input')
  }

  public getCacheLoadButton(): Locator {
    return this.page.getByTestId('cache-load')
  }

  public getCacheRefreshButton(): Locator {
    return this.page.getByTestId('cache-refresh')
  }

  public getCacheInvalidateButton(): Locator {
    return this.page.getByTestId('cache-invalidate')
  }

  public getCachePurgeButton(): Locator {
    return this.page.getByTestId('cache-purge')
  }

  public getCacheMovieResult(): Locator {
    return this.page.getByTestId('cache-movie-result')
  }

  public getCacheHitIndicator(): Locator {
    return this.page.getByTestId('cache-hit-indicator')
  }

  public getCacheMovieTitle(): Locator {
    return this.page.getByTestId('cache-movie-title')
  }

  public getCachedMovieQuery(): Locator {
    return this.page.getByTestId('cached-movie-query')
  }

  public getNoCachedMovie(): Locator {
    return this.page.getByTestId('no-cached-movie')
  }

  public getCachedMoviesList(): Locator {
    return this.page.getByTestId('cached-movies-list')
  }

  public getCachedMovieItems(): Locator {
    return this.page.locator('[data-testid="cached-movie-item"]')
  }

  public getNoCachedMovies(): Locator {
    return this.page.getByTestId('no-cached-movies')
  }

  public async gotoCacheTest(): Promise<void> {
    await this.page.goto('/movies/test')
    await this.page.waitForLoadState('networkidle')
  }

  public async loadCacheMovie(tmdbId: number): Promise<void> {
    await this.getCacheTmdbInput().fill(String(tmdbId))
    await this.getCacheLoadButton().click()
  }

  public async refreshCacheMovie(tmdbId: number): Promise<void> {
    await this.getCacheTmdbInput().fill(String(tmdbId))
    await this.getCacheRefreshButton().click()
  }

  public async invalidateCacheMovie(tmdbId: number): Promise<void> {
    await this.getCacheTmdbInput().fill(String(tmdbId))
    await this.getCacheInvalidateButton().click()
  }

  public async purgeCache(): Promise<void> {
    await this.getCachePurgeButton().click()
  }

  public getCacheDocInput(): Locator {
    return this.page.getByTestId('cache-doc-input')
  }

  public getCacheDocClear(): Locator {
    return this.page.getByTestId('cache-doc-clear')
  }

  public getCacheUpdateTitleInput(): Locator {
    return this.page.getByTestId('cache-update-title')
  }

  public getCacheDocUpdateButton(): Locator {
    return this.page.getByTestId('cache-doc-update')
  }

  public getCacheDocRmButton(): Locator {
    return this.page.getByTestId('cache-doc-rm')
  }

  public getReadLoading(): Locator {
    return this.page.getByTestId('read-loading')
  }

  public getReadResult(): Locator {
    return this.page.getByTestId('read-result')
  }

  public getReadTitle(): Locator {
    return this.page.getByTestId('read-title')
  }

  public getReadTmdbId(): Locator {
    return this.page.getByTestId('read-tmdb-id')
  }

  public getReadDocId(): Locator {
    return this.page.getByTestId('read-doc-id')
  }

  public getReadNotFound(): Locator {
    return this.page.getByTestId('read-not-found')
  }

  public getReadEmpty(): Locator {
    return this.page.getByTestId('read-empty')
  }

  public getCachedItemDocId(index: number): Locator {
    return this.getCachedMovieItems().nth(index).locator('[data-testid="cached-item-doc-id"]')
  }

  public getCachedItemTitle(index: number): Locator {
    return this.getCachedMovieItems().nth(index).locator('[data-testid="cached-item-title"]')
  }

  public async getFirstCachedDocId(): Promise<string> {
    const idText = await this.getCachedItemDocId(0).textContent()
    return idText ?? ''
  }

  public async readCacheDoc(docId: string): Promise<void> {
    await this.getCacheDocInput().fill(docId)
    await this.page.waitForTimeout(500)
  }

  public async updateCacheDoc(docId: string, newTitle: string): Promise<void> {
    await this.getCacheDocInput().fill(docId)
    await this.getCacheUpdateTitleInput().fill(newTitle)
    await this.getCacheDocUpdateButton().click()
  }

  public async rmCacheDoc(docId: string): Promise<void> {
    await this.getCacheDocInput().fill(docId)
    await this.getCacheDocRmButton().click()
  }

  public async clearDocInput(): Promise<void> {
    await this.getCacheDocClear().click()
  }
}

export default MoviePage
