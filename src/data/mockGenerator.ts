// ============================================================
// GENERATOR DANYCH MOCK — tworzy realistyczny program TV
// na 7 dni dla wszystkich kanałów
//
// UWAGA DLA DEVELOPERA:
// Zastąp tę funkcję prawdziwym wywołaniem API kiedy będziesz
// mieć dostęp do serwisu z danymi EPG (np. xmltv.pl, epg.pw)
// ============================================================

import {
  addMinutes, addDays, startOfDay, setHours, setMinutes,
  format, isSameDay
} from 'date-fns';
import { Program, ProgramGenre } from '../types';
import { CHANNELS } from './channels';

// Licznik do generowania unikalnych ID
let idCounter = 1;
const genId = () => `prog_${idCounter++}`;

// ─── SZABLONY PROGRAMÓW ────────────────────────────────────
// Każdy szablon to dane jednego programu TV

interface ProgramTemplate {
  title: string;
  originalTitle?: string;
  description: string;
  genre: ProgramGenre;
  country?: string;
  year?: number;
  rating?: string;
  durationMin: number; // czas trwania w minutach
  isLive?: boolean;
  isPremiere?: boolean;
}

// Programy informacyjne (krótkie bloki)
const NEWS_BLOCKS: ProgramTemplate[] = [
  { title: 'Wiadomości', description: 'Główny serwis informacyjny. Najważniejsze wydarzenia z kraju i ze świata.', genre: 'news', country: 'PL', durationMin: 25, isLive: true },
  { title: 'Teleexpress', description: 'Krótki serwis informacyjny — najważniejsze wiadomości w pigułce.', genre: 'news', country: 'PL', durationMin: 15, isLive: true },
  { title: 'Panorama', description: 'Serwis informacyjny TVP2. Wiadomości z kraju i zagranicy.', genre: 'news', country: 'PL', durationMin: 20, isLive: true },
  { title: 'Fakty', description: 'Główny serwis informacyjny TVN. Rzetelne wiadomości.', genre: 'news', country: 'PL', durationMin: 25, isLive: true },
  { title: 'Fakty po Faktach', description: 'Komentarze do najważniejszych wydarzeń dnia.', genre: 'news', country: 'PL', durationMin: 50, isLive: true },
  { title: 'Fakty 24', description: 'Całodobowy serwis informacyjny TVN24.', genre: 'news', country: 'PL', durationMin: 30, isLive: true },
  { title: 'Wydarzenia', description: 'Główny serwis informacyjny Polsatu.', genre: 'news', country: 'PL', durationMin: 25, isLive: true },
  { title: 'Wieczór z Polsat News', description: 'Podsumowanie dnia w Polsat News z gośćmi w studiu.', genre: 'news', country: 'PL', durationMin: 55, isLive: true },
  { title: 'Studio Polska', description: 'Debata publicystyczna z udziałem polityków i ekspertów.', genre: 'magazin', country: 'PL', durationMin: 50 },
  { title: 'Minęła 20', description: 'Wieczorny program publicystyczny.', genre: 'magazin', country: 'PL', durationMin: 45 },
  { title: 'Minęła 8', description: 'Poranny program publicystyczny z gośćmi.', genre: 'magazin', country: 'PL', durationMin: 55, isLive: true },
  { title: 'Pogoda', description: 'Prognoza pogody na najbliższe dni.', genre: 'news', country: 'PL', durationMin: 10, isLive: true },
  { title: 'Sport', description: 'Przegląd wyników sportowych dnia.', genre: 'news', country: 'PL', durationMin: 10 },
  { title: 'Tydzień', description: 'Przegląd najważniejszych wydarzeń tygodnia.', genre: 'magazin', country: 'PL', durationMin: 40 },
];

// Polskie seriale
const POLISH_SERIES: ProgramTemplate[] = [
  { title: 'Na Wspólnej', description: 'Popularny serial obyczajowy o mieszkańcach warszawskiej kamienicy. Perypetie sąsiadów, miłości i przyjaźnie.', genre: 'series', country: 'PL', durationMin: 25 },
  { title: 'Barwy Szczęścia', description: 'Polska telenowela codzienna. Historia kilku rodzin z Warszawy powiązanych ze sobą losem.', genre: 'series', country: 'PL', durationMin: 25 },
  { title: 'M jak Miłość', description: 'Najdłużej emitowany polski serial rodzinny. Historia rodziny Mostowiaków.', genre: 'series', country: 'PL', durationMin: 45 },
  { title: 'Komisarz Alex', description: 'Polski serial kryminalny. Komisarz Alex prowadzi trudne śledztwa na Mazurach.', genre: 'series', country: 'PL', durationMin: 50 },
  { title: 'Pierwsza Miłość', description: 'Codzienna telenowela o miłości, rodzinie i przyjaźni.', genre: 'series', country: 'PL', durationMin: 25 },
  { title: 'Klan', description: 'Najstarsza polska telenowela. Historia rodziny Lubiczów na przestrzeni lat.', genre: 'series', country: 'PL', durationMin: 25 },
  { title: 'Lombard. Życie pod zastaw', description: 'Dramat obyczajowy o ludziach trafiających do lombardu z różnych powodów.', genre: 'series', country: 'PL', durationMin: 50 },
  { title: 'Szpital', description: 'Serial medyczny o codziennej pracy lekarzy i pielęgniarek.', genre: 'series', country: 'PL', durationMin: 45 },
  { title: 'Strażacy', description: 'Dramat o życiu zawodowych strażaków i ich rodzin.', genre: 'series', country: 'PL', durationMin: 45 },
  { title: 'Czarny Mercedes', description: 'Kryminał retro osadzony w Krakowie lat 80. Inspektor Maciejewski rozwiązuje zagadkowe zbrodnie.', genre: 'series', country: 'PL', durationMin: 50 },
  { title: 'Ojciec Mateusz', description: 'Popularny serial detektywistyczny. Ksiądz Mateusz pomaga policji rozwiązywać zbrodnie w Sandomierzu.', genre: 'series', country: 'PL', durationMin: 50 },
  { title: 'Na dobre i na złe', description: 'Długoletni serial medyczny o lekarzach małego szpitala w Leśnej Górze.', genre: 'series', country: 'PL', durationMin: 50 },
  { title: 'Przyjaciółki', description: 'Cztery przyjaciółki z różnych środowisk — ich przyjaźń, miłości i codzienne perypetie.', genre: 'series', country: 'PL', durationMin: 50 },
  { title: 'Leśniczówka', description: 'Nowa polska telenowela o życiu na wsi i miłości wbrew wszystkiemu.', genre: 'series', country: 'PL', durationMin: 25 },
];

// Zagraniczne seriale
const FOREIGN_SERIES: ProgramTemplate[] = [
  { title: 'Prawo i porządek', originalTitle: 'Law & Order', description: 'Kultowy amerykański serial kryminalny. Dwie części śledztwa — policja i prokuratura.', genre: 'series', country: 'USA', year: 2023, durationMin: 50 },
  { title: 'CSI: Las Vegas', originalTitle: 'CSI: Vegas', description: 'Technicy kryminalistyczni rozwiązują zbrodnie przy pomocy nowoczesnych metod naukowych.', genre: 'series', country: 'USA', year: 2022, durationMin: 50 },
  { title: 'Hawaii Five-0', originalTitle: 'Hawaii Five-0', description: 'Elitarny oddział policji na Hawajach rozwiązuje najbardziej skomplikowane sprawy.', genre: 'series', country: 'USA', year: 2019, durationMin: 45 },
  { title: 'Żona Idealna', originalTitle: 'The Good Wife', description: 'Drama o prawniczce, która wraca do zawodu po skandalu politycznym z udziałem jej męża.', genre: 'series', country: 'USA', year: 2016, durationMin: 50, rating: '12+' },
  { title: 'Suits', description: 'Błyskotliwy prawnik bez dyplomu pracuje w prestiżowej kancelarii prawniczej w Nowym Jorku.', genre: 'series', country: 'USA', year: 2019, durationMin: 50 },
  { title: 'Gra o Tron', originalTitle: 'Game of Thrones', description: 'Epicki serial fantasy o walce o władzę na kontynencie Westeros. Wielkie bitwy i zaskakujące zwroty akcji.', genre: 'series', country: 'USA', year: 2019, rating: '18+', durationMin: 60 },
  { title: 'Wiedźmin', originalTitle: 'The Witcher', description: 'Serial fantasy na podstawie sagi Andrzeja Sapkowskiego. Geralt z Rivii — zabójca potworów.', genre: 'series', country: 'USA', year: 2023, rating: '16+', durationMin: 60 },
  { title: 'Breaking Bad', description: 'Nauczyciel chemii z rakiem płuc staje się producentem metamfetaminy. Kultowy serial kryminalny.', genre: 'series', country: 'USA', year: 2013, rating: '18+', durationMin: 50 },
  { title: 'Jak Poznałem Waszą Matkę', originalTitle: 'How I Met Your Mother', description: 'Kultowy sitcom o przyjaciołach w Nowym Jorku. Ted opowiada dzieciom jak poznał ich matkę.', genre: 'series', country: 'USA', durationMin: 25 },
  { title: 'Teoria Wielkiego Podrywu', originalTitle: 'The Big Bang Theory', description: 'Komedia o grupie naukowców i ich sąsiadce-aktorce. Humor ze świata nauki.', genre: 'series', country: 'USA', durationMin: 25 },
  { title: 'Akt Zemsty', originalTitle: 'Revenge', description: 'Amanda Clarke powraca do Hamptons by zemścić się na tych, którzy zniszczyli jej ojca.', genre: 'series', country: 'USA', year: 2015, durationMin: 50 },
  { title: 'Dom Papierowy', originalTitle: 'La Casa de Papel', description: 'Genialny złodziej organizuje spektakularny napad na Bank Hiszpanii. Thriller bez chwili oddechu.', genre: 'series', country: 'ES', year: 2021, rating: '16+', durationMin: 50 },
  { title: 'Dark', description: 'Niemiecki thriller sci-fi o podróżach w czasie i zaginionych dzieciach w małym mieście.', genre: 'series', country: 'DE', year: 2020, rating: '16+', durationMin: 60 },
  { title: '4 Blocks', description: 'Berliński thriller kryminalny o arabskim klanie przestępczym w Niemczech.', genre: 'series', country: 'DE', year: 2019, rating: '18+', durationMin: 50 },
];

// Filmy polskie
const POLISH_MOVIES: ProgramTemplate[] = [
  { title: 'Listy do Mikołaja', description: 'Polska komedia bożonarodzeniowa. Ojciec-wdowiec stara się spełnić świąteczne marzenia córki.', genre: 'movie', country: 'PL', year: 2011, durationMin: 95 },
  { title: 'Carte Blanche', description: 'Dramat o niewidomym pianiście, który zostaje mistrzem szachowym. Inspirowana prawdziwą historią.', genre: 'movie', country: 'PL', year: 2015, durationMin: 100 },
  { title: 'Bogowie', description: 'Biografia prof. Zbigniewa Religi — pioniera polskiej kardiochirurgii. Walka o pierwsze przeszczepy serca.', genre: 'movie', country: 'PL', year: 2014, durationMin: 110 },
  { title: 'Fotograf', description: 'Dramat historyczny o polskim fotografie, który dokumentował tragedię Żydów w getcie łódzkim.', genre: 'movie', country: 'PL', year: 2014, durationMin: 100 },
  { title: 'Chemia', description: 'Poruszający dramat o polskiej pielęgniarce walczącej z rakiem i jej mężu, który szuka ratunku.', genre: 'movie', country: 'PL', year: 2015, durationMin: 95 },
  { title: 'Pitbull', description: 'Brutalny i szczery obraz polskiego świata przestępczego z perspektywy policjantów wydziału do walki z gangami.', genre: 'movie', country: 'PL', year: 2021, rating: '18+', durationMin: 100 },
  { title: 'Smoleńsk', description: 'Film fabularny o katastrofie smoleńskiej z 2010 roku.', genre: 'movie', country: 'PL', year: 2016, durationMin: 110 },
  { title: 'Kurier', description: 'Wojenny dramat o emisariuszu Jana Nowaka-Jeziorańskiego przemierzającym Europę podczas II Wojny Światowej.', genre: 'movie', country: 'PL', year: 2019, durationMin: 105 },
];

// Filmy zagraniczne
const FOREIGN_MOVIES: ProgramTemplate[] = [
  { title: 'Avengers: Koniec Gry', originalTitle: 'Avengers: Endgame', description: 'Finałowy film MCU. Ocalali bohaterowie próbują odwrócić skutki działań Thanosa i przywrócić połowę życia we wszechświecie.', genre: 'movie', country: 'USA', year: 2019, rating: '12+', durationMin: 181, isPremiere: false },
  { title: 'Incepcja', originalTitle: 'Inception', description: 'Złodziej specjalizujący się w kradzieży pomysłów z ludzkich snów otrzymuje misję odwrotną — wszczepienie idei.', genre: 'movie', country: 'USA', year: 2010, rating: '12+', durationMin: 148 },
  { title: 'Interstellar', description: 'Naukowcy podróżują przez tunele czasoprzestrzenne w poszukiwaniu nowej planety dla ludzkości.', genre: 'movie', country: 'USA', year: 2014, rating: '12+', durationMin: 169 },
  { title: 'Django', originalTitle: 'Django Unchained', description: 'Oswobodzony niewolnik i łowca głów podróżują przez Południe USA, by uratować żonę Django.', genre: 'movie', country: 'USA', year: 2012, rating: '18+', durationMin: 165 },
  { title: 'Skazani na Shawshank', originalTitle: 'The Shawshank Redemption', description: 'Bankier niesłusznie skazany za morderstwo przeżywa lata w ciężkim więzieniu, nie tracąc nadziei.', genre: 'movie', country: 'USA', year: 1994, durationMin: 142 },
  { title: 'Gladiator', description: 'Generał zamienia się w niewolnika, niewolnik zostaje gladiatorem, gladiator stawia czoła imperium.', genre: 'movie', country: 'USA', year: 2000, rating: '16+', durationMin: 155 },
  { title: 'Titanic', description: 'Historia miłości na tle katastrofy najsłynniejszego transatlantyku świata.', genre: 'movie', country: 'USA', year: 1997, durationMin: 194 },
  { title: 'Leon Zawodowiec', originalTitle: 'Léon: The Professional', description: 'Płatny zabójca opiekuje się 12-letnią dziewczynką, której rodzina została zamordowana.', genre: 'movie', country: 'FR', year: 1994, rating: '16+', durationMin: 110 },
  { title: 'Złodzieje Snów', originalTitle: 'Now You See Me', description: 'Czwórka iluzjonistów okrada banki podczas pokazów na oczach publiczności i rozdaje pieniądze widzom.', genre: 'movie', country: 'USA', year: 2013, rating: '12+', durationMin: 115 },
  { title: 'Szybcy i Wściekli', originalTitle: 'Fast & Furious', description: 'Kultowa seria akcji o wyścigach ulicznych i teamie Dominica Torretto.', genre: 'movie', country: 'USA', year: 2022, rating: '12+', durationMin: 130 },
  { title: 'Matrix', description: 'Programista odkrywa, że rzeczywistość jest symulacją komputerową. Kultowy film sci-fi.', genre: 'movie', country: 'USA', year: 1999, rating: '16+', durationMin: 136 },
  { title: 'Pięćdziesiąt Twarzy Greya', originalTitle: 'Fifty Shades of Grey', description: 'Romans studentki i tajemniczego miliardera. Ekranizacja bestsellera.', genre: 'movie', country: 'USA', year: 2015, rating: '18+', durationMin: 125 },
  { title: 'Renata idzie po swoje', originalTitle: 'Renata goes for it', description: 'Komedia romantyczna o kobiecie szukającej siebie w Nowym Jorku.', genre: 'movie', country: 'USA', year: 2020, durationMin: 100 },
  { title: 'Mamma Mia!', description: 'Musicalowa komedia z piosenkami ABBA. Przed ślubem dziewczyna próbuje dowiedzieć się kto jest jej ojcem.', genre: 'movie', country: 'GB', year: 2008, durationMin: 108 },
  { title: 'Hobbit: Pustkowie Smauga', originalTitle: 'The Hobbit: The Desolation of Smaug', description: 'Bilbo i krasnoludy kontynuują wyprawę do Samotnej Góry, mierząc się z elfami i potwornym smokiem.', genre: 'movie', country: 'NZ', year: 2013, rating: '12+', durationMin: 161 },
  { title: 'Joker', description: 'Ponura historia przeistoczenia się nieudacznika w kultowego supervillaina Gotham City.', genre: 'movie', country: 'USA', year: 2019, rating: '16+', durationMin: 122 },
  { title: 'Parasite', description: 'Koreański thriller społeczny. Bezrobotna rodzina stopniowo infiltruje bogatą rezydencję. Oscarowy film.', genre: 'movie', country: 'KR', year: 2019, rating: '16+', durationMin: 132 },
];

// Programy rozrywkowe i show
const ENTERTAINMENT: ProgramTemplate[] = [
  { title: 'Mam Talent!', description: 'Polskie eliminacje do prestiżowego konkursu talentów. Jurorzy oceniają różnorodne występy.', genre: 'entertainment', country: 'PL', durationMin: 80, isLive: true },
  { title: 'Taniec z Gwiazdami', description: 'Gwiazdy showbiznesu uczą się tańca z profesjonalnymi partnerami i rywalizują przed kamerami.', genre: 'entertainment', country: 'PL', durationMin: 90, isLive: true },
  { title: 'Twoja Twarz Brzmi Znajomo', description: 'Znani artyści przeistaczają się w inne gwiazdy. Spektakularne przemiany i śpiewanie.', genre: 'entertainment', country: 'PL', durationMin: 95 },
  { title: 'Dzień Dobry TVN', description: 'Poranny program TVN z newsami, poradami i rozrywką. Na żywo z gośćmi w studiu.', genre: 'entertainment', country: 'PL', durationMin: 150, isLive: true },
  { title: 'Pytanie na Śniadanie', description: 'Poranno-poranny program TVP ze smacznymi wywiadami i poradami na co dzień.', genre: 'entertainment', country: 'PL', durationMin: 120, isLive: true },
  { title: 'The Voice of Poland', description: 'Polskie przesłuchania w ciemno do największego wokalnego talent show. Gwiazdy jako trenerzy.', genre: 'entertainment', country: 'PL', durationMin: 90, isLive: true },
  { title: 'Top Chef', description: 'Rywalizacja utalentowanych kucharzy o tytuł Top Chefa. Kreatywne kulinarne wyzwania.', genre: 'entertainment', country: 'PL', durationMin: 60 },
  { title: 'Koło Fortuny', description: 'Popularny teleturniej słowny. Uczestnicy odgadują hasła obracając kołem fortuny.', genre: 'entertainment', country: 'PL', durationMin: 25 },
  { title: 'Milionerzy', description: 'Teleturniej pytań i odpowiedzi. Czy zdobędziesz milion?', genre: 'entertainment', country: 'PL', durationMin: 50 },
  { title: 'Big Brother', description: 'Reality show — uczestnicy mieszkają razem przez kilka miesięcy pod okiem kamer.', genre: 'entertainment', country: 'PL', durationMin: 60, isLive: true },
  { title: 'Kabaret Pod Wyrwigroszem', description: 'Najlepsze skecze i monologi znanych polskich kabaretów.', genre: 'entertainment', country: 'PL', durationMin: 55 },
  { title: 'Polsat SuperHit Festiwal', description: 'Retransmisja największych hitów Festiwalu w Sopocie.', genre: 'entertainment', country: 'PL', durationMin: 120, isLive: true },
];

// Programy sportowe
const SPORT_PROGRAMS: ProgramTemplate[] = [
  { title: 'Piłka nożna: PKO BP Ekstraklasa', description: 'Mecz polskiej ekstraklasy na żywo. Najlepsi polscy piłkarze rywalizują o mistrzostwo.', genre: 'sport', country: 'PL', durationMin: 105, isLive: true },
  { title: 'Liga Mistrzów UEFA', description: 'Mecz fazy grupowej Ligi Mistrzów. Najlepsze europejskie kluby na jednej arenie.', genre: 'sport', country: 'EU', durationMin: 105, isLive: true },
  { title: 'Siatkówka: Plus Liga', description: 'Mecz polskiej Ligi Siatkarskiej mężczyzn. Emocjonująca rywalizacja czołowych polskich drużyn.', genre: 'sport', country: 'PL', durationMin: 100, isLive: true },
  { title: 'Skoki narciarskie', description: 'Zawody Pucharu Świata w skokach narciarskich. Polacy walczą z najlepszymi na świecie.', genre: 'sport', country: 'PL', durationMin: 90, isLive: true },
  { title: 'MotoGP', description: 'Wyścig Grand Prix Motocykli MotoGP. Najszybsi motocykliści świata na torze.', genre: 'sport', country: 'INT', durationMin: 90, isLive: true },
  { title: 'Formuła 1', description: 'Grand Prix Formuły 1. Najlepsze bolidy i kierowcy w najbardziej prestiżowym sporcie motorowym.', genre: 'sport', country: 'INT', durationMin: 110, isLive: true },
  { title: 'Tenis: Wimbledon', description: 'Mecze prestiżowego turnieju na trawiastych kortach. Wimbledon — najważniejszy turniej tenisowy.', genre: 'sport', country: 'GB', durationMin: 120, isLive: true },
  { title: 'Boks: Gala Bokserska', description: 'Gala bokserska z udziałem polskich pięściarzy. Walka o tytuł mistrzowski.', genre: 'sport', country: 'PL', durationMin: 120, isLive: true },
  { title: 'Studio Sport', description: 'Przegląd wydarzeń sportowych dnia. Wyniki, skróty i komentarze ekspertów.', genre: 'sport', country: 'PL', durationMin: 30, isLive: true },
  { title: 'Magazyn Sportowy', description: 'Cotygodniowy magazyn z najciekawszymi wywiadami i reportażami ze świata sportu.', genre: 'sport', country: 'PL', durationMin: 50 },
];

// Programy dokumentalne
const DOCUMENTARIES: ProgramTemplate[] = [
  { title: 'Nieznana Ziemia', description: 'Fascynująca wyprawa w najbardziej odległe zakątki naszej planety. Niesamowite krajobrazy i dzikie zwierzęta.', genre: 'documentary', country: 'GB', durationMin: 50 },
  { title: 'Świat Dzikiej Przyrody', description: 'Dokument przyrodniczy BBC o życiu zwierząt na różnych kontynentach.', genre: 'documentary', country: 'GB', durationMin: 55 },
  { title: 'Misja NASA', description: 'Historia wielkich misji kosmicznych NASA. Kulisy przełomowych odkryć.', genre: 'documentary', country: 'USA', durationMin: 50 },
  { title: 'Sekrety Historii', description: 'Odkrywamy tajemnice wielkich historycznych wydarzeń. Nowe odkrycia i interpretacje.', genre: 'documentary', country: 'USA', durationMin: 50 },
  { title: 'Jak to jest zrobione?', description: 'Zaglądamy za kulisy produkcji znanych produktów. Fascynujące procesy technologiczne.', genre: 'documentary', country: 'USA', durationMin: 25 },
  { title: 'Polskie Drogi', description: 'Historia Polski widziana przez pryzmat losów zwykłych ludzi podczas II Wojny Światowej.', genre: 'documentary', country: 'PL', year: 1976, durationMin: 50 },
  { title: 'Najniebezpieczniejsze Drogi Świata', description: 'Reporterzy jeżdżą najtrudniejszymi szlakami komunikacyjnymi na świecie. Ekstremalne warunki.', genre: 'documentary', country: 'FR', durationMin: 50 },
  { title: 'Planète Bêtes', description: 'Fascynujący dokument o zachowaniach zwierząt. Nagrania z kamer-pułapek i obserwacje terenowe.', genre: 'documentary', country: 'FR', durationMin: 55 },
  { title: 'Kto tu rządzi?', description: 'Dokument o hierarchii władzy w świecie dzikich zwierząt. Kto jest na szczycie łańcucha pokarmowego?', genre: 'documentary', country: 'USA', durationMin: 50 },
];

// Programy dziecięce
const KIDS_PROGRAMS: ProgramTemplate[] = [
  { title: 'SpongeBob Kanciastoporty', originalTitle: 'SpongeBob SquarePants', description: 'Przygody SpongeBoba i jego przyjaciół w Bikini Bottom.', genre: 'kids', country: 'USA', durationMin: 25 },
  { title: 'Świnka Peppa', originalTitle: 'Peppa Pig', description: 'Peppa i jej rodzina przeżywają codzienne przygody.', genre: 'kids', country: 'GB', durationMin: 25 },
  { title: 'Psi Patrol', originalTitle: 'PAW Patrol', description: 'Dzielne szczeniaki pod wodzą Rydera ratują każdą sytuację w Adventure Bay.', genre: 'kids', country: 'CA', durationMin: 25 },
  { title: 'Ben 10', description: 'Ben Tennyson odkrywa kosmiczny zegarek dający mu moc zamieniania się w 10 różnych kosmitów.', genre: 'kids', country: 'USA', durationMin: 25 },
  { title: 'Reksio', description: 'Kultowy polski serial animowany o sympatycznym psie Reksi.', genre: 'kids', country: 'PL', year: 1967, durationMin: 10 },
  { title: 'Miś Uszatek', description: 'Klasyczna polska bajka o misiu ze złamanym uszkiem.', genre: 'kids', country: 'PL', year: 1975, durationMin: 10 },
  { title: 'Dobranocka', description: 'Klasyczne bajki na dobranoc dla najmłodszych widzów.', genre: 'kids', country: 'PL', durationMin: 20 },
  { title: 'Bluey', description: 'Australijska animacja o rodzinie niebieskich psów. Nagradzana seria dla dzieci i rodziców.', genre: 'kids', country: 'AU', durationMin: 25 },
];

// Programy muzyczne
const MUSIC_PROGRAMS: ProgramTemplate[] = [
  { title: 'Top 20 Wszech Czasów', description: 'Najlepsze teledyski i hity muzyczne wszech czasów w jednym programie.', genre: 'music', country: 'PL', durationMin: 60 },
  { title: 'Sopot Festival', description: 'Transmisja Festiwalu Muzyki w Sopocie — polskie gwiazdy i goście zagraniczni.', genre: 'music', country: 'PL', durationMin: 120, isLive: true },
  { title: 'MTV Unplugged', description: 'Kultowe akustyczne koncerty największych gwiazd muzyki.', genre: 'music', country: 'USA', durationMin: 60 },
  { title: 'Przeboje roku', description: 'Zestawienie największych muzycznych hitów ostatnich 12 miesięcy.', genre: 'music', country: 'PL', durationMin: 50 },
];

// Programy poranne i poranki
const MORNING_SHOWS: ProgramTemplate[] = [
  { title: 'Teleranek', description: 'Poranny blok programów dla dzieci w TVP1. Bajki, zabawy i edukacja.', genre: 'kids', country: 'PL', durationMin: 90 },
  { title: 'Kawa czy Herbata?', description: 'Poranno-poranny program TVP1. Lżejsze newsy, porady i rozrywka na start dnia.', genre: 'entertainment', country: 'PL', durationMin: 70, isLive: true },
  { title: 'Nowe Jutro', description: 'Poranny magazyn informacyjno-rozrywkowy. Staramy się na dobry start.', genre: 'entertainment', country: 'PL', durationMin: 60, isLive: true },
];

// ─── GENEROWANIE DANYCH ────────────────────────────────────

/**
 * Wypełnia cały dzień programami dla danego kanału.
 * Programy są dobierane na podstawie pory dnia i profilu kanału.
 */
function generateDaySchedule(
  channelId: string,
  date: Date
): Program[] {
  const programs: Program[] = [];
  const dayStart = startOfDay(date);

  // Pobierz odpowiedni zestaw szablonów dla kanału
  const templates = getTemplatesForChannel(channelId);

  // Generuj od 06:00 (niektóre kanały od 00:00)
  let currentTime = setMinutes(setHours(dayStart, 6), 0);
  const dayEnd = addDays(dayStart, 1);

  // Dodaj nocne programy 00:00-06:00
  const nightTime = setMinutes(setHours(dayStart, 0), 0);
  let nightCurrent = nightTime;
  while (nightCurrent < currentTime) {
    const template = pickTemplate(templates, nightCurrent);
    const prog = createProgram(channelId, template, nightCurrent);
    programs.push(prog);
    nightCurrent = prog.endTime;
    if (nightCurrent >= currentTime) break;
  }

  // Generuj od rana do końca doby
  while (currentTime < dayEnd) {
    const template = pickTemplate(templates, currentTime);
    const prog = createProgram(channelId, template, currentTime);
    programs.push(prog);
    currentTime = prog.endTime;
  }

  return programs;
}

/**
 * Wybiera szablon programu na podstawie pory dnia i kanału.
 */
function pickTemplate(
  allTemplates: ProgramTemplate[],
  time: Date
): ProgramTemplate {
  const hour = time.getHours();
  let pool: ProgramTemplate[];

  // Rano (6-10): poranki, wiadomości, bajki
  if (hour >= 6 && hour < 10) {
    pool = allTemplates.filter(t =>
      t.genre === 'news' || t.genre === 'kids' || t.genre === 'entertainment' || t.genre === 'magazin'
    );
  }
  // Przedpołudnie (10-12): seriale, magazyny
  else if (hour >= 10 && hour < 12) {
    pool = allTemplates.filter(t =>
      t.genre === 'series' || t.genre === 'magazin' || t.genre === 'entertainment'
    );
  }
  // Południe (12-14): serwis informacyjny, seriale
  else if (hour >= 12 && hour < 14) {
    pool = allTemplates.filter(t =>
      t.genre === 'news' || t.genre === 'series' || t.genre === 'entertainment'
    );
  }
  // Popołudnie (14-18): seriale, filmy
  else if (hour >= 14 && hour < 18) {
    pool = allTemplates.filter(t =>
      t.genre === 'series' || t.genre === 'movie' || t.genre === 'entertainment'
    );
  }
  // Wieczór (18-22): prime time — najlepsze programy
  else if (hour >= 18 && hour < 22) {
    pool = allTemplates.filter(t =>
      t.genre === 'entertainment' || t.genre === 'movie' || t.genre === 'series' || t.genre === 'sport'
    );
  }
  // Późny wieczór (22-24): filmy, seriale, talk-show
  else {
    pool = allTemplates.filter(t =>
      t.genre === 'movie' || t.genre === 'series' || t.genre === 'entertainment'
    );
  }

  // Fallback — jeśli brak pasujących, użyj wszystkich
  if (pool.length === 0) pool = allTemplates;

  // Pseudo-losowy wybór (deterministic na podstawie daty i godziny)
  const seed = time.getTime();
  const idx = Math.abs(seed) % pool.length;
  return pool[idx];
}

/**
 * Tworzy obiekt Program na podstawie szablonu.
 */
function createProgram(
  channelId: string,
  template: ProgramTemplate,
  startTime: Date
): Program {
  const endTime = addMinutes(startTime, template.durationMin);
  return {
    id: genId(),
    channelId,
    title: template.title,
    originalTitle: template.originalTitle,
    description: template.description,
    startTime,
    endTime,
    genre: template.genre,
    country: template.country,
    year: template.year,
    rating: template.rating,
    isLive: template.isLive,
    isPremiere: template.isPremiere,
  };
}

/**
 * Dobiera zestaw szablonów odpowiedni dla danego kanału.
 */
function getTemplatesForChannel(channelId: string): ProgramTemplate[] {
  switch (channelId) {
    case 'tvp1':
      return [
        ...NEWS_BLOCKS.slice(0, 6),
        ...POLISH_SERIES.slice(0, 8),
        ...POLISH_MOVIES.slice(0, 4),
        ...MORNING_SHOWS,
        ...ENTERTAINMENT.slice(0, 5),
        ...DOCUMENTARIES.slice(0, 3),
      ];
    case 'tvp2':
      return [
        ...NEWS_BLOCKS.slice(2, 7),
        ...POLISH_SERIES.slice(4, 12),
        ...ENTERTAINMENT,
        ...FOREIGN_MOVIES.slice(0, 6),
        ...DOCUMENTARIES.slice(0, 4),
      ];
    case 'tvn':
      return [
        ...NEWS_BLOCKS.filter(n => n.title.includes('Fakty') || n.title === 'Pogoda'),
        ...MORNING_SHOWS.slice(1, 3),
        ...POLISH_SERIES.slice(0, 5),
        ...FOREIGN_SERIES.slice(0, 8),
        ...FOREIGN_MOVIES.slice(0, 8),
        ...ENTERTAINMENT.slice(0, 6),
      ];
    case 'polsat':
      return [
        ...NEWS_BLOCKS.filter(n => n.title.includes('Wydarzen') || n.title === 'Pogoda'),
        ...ENTERTAINMENT,
        ...POLISH_SERIES.slice(2, 10),
        ...FOREIGN_SERIES.slice(3, 10),
        ...FOREIGN_MOVIES.slice(4, 12),
      ];
    case 'tv4':
      return [
        ...FOREIGN_MOVIES,
        ...FOREIGN_SERIES,
        ...ENTERTAINMENT.slice(3, 8),
      ];
    case 'ttv':
      return [
        ...ENTERTAINMENT,
        ...POLISH_SERIES.slice(6, 12),
        ...NEWS_BLOCKS.slice(0, 4),
        ...DOCUMENTARIES.slice(0, 4),
      ];
    case 'tvpinfo':
    case 'tvn24':
      return NEWS_BLOCKS;
    case 'tvn7':
    case 'polsat2':
    case 'tvpseriale':
      return [
        ...FOREIGN_SERIES,
        ...POLISH_SERIES,
        ...FOREIGN_MOVIES.slice(0, 8),
      ];
    case 'axn':
    case 'fox':
      return [
        ...FOREIGN_SERIES,
        ...FOREIGN_MOVIES.slice(0, 10),
      ];
    case 'comedycentral':
      return [
        ...FOREIGN_SERIES.slice(7, 12),
        ...FOREIGN_MOVIES.slice(12, 16),
        ...ENTERTAINMENT.slice(8, 12),
      ];
    case 'hbo':
    case 'hbo2':
      return [
        ...FOREIGN_MOVIES,
        ...FOREIGN_SERIES.slice(5, 13),
      ];
    case 'tvpsport':
    case 'eurosport1':
    case 'eurosport2':
      return SPORT_PROGRAMS;
    case 'natgeo':
    case 'discovery':
    case 'animalplanet':
    case 'history':
    case 'tvphistoria':
    case 'tvpkultura':
      return DOCUMENTARIES;
    case 'tvprozrywka':
      return [
        ...ENTERTAINMENT,
        ...POLISH_SERIES.slice(0, 6),
        ...MUSIC_PROGRAMS,
      ];
    default:
      return [...FOREIGN_MOVIES, ...FOREIGN_SERIES, ...ENTERTAINMENT];
  }
}

// ─── API PUBLICZNE ─────────────────────────────────────────

/**
 * Generuje programy TV dla wszystkich kanałów na podaną liczbę dni.
 * @param startDate - dzień startowy (domyślnie dzisiaj)
 * @param days - liczba dni do wygenerowania (domyślnie 7)
 */
export function generateMockPrograms(
  startDate: Date = new Date(),
  days = 7
): Program[] {
  const allPrograms: Program[] = [];
  const channelIds = CHANNELS.map(ch => ch.id);

  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    for (const channelId of channelIds) {
      const dayPrograms = generateDaySchedule(channelId, date);
      allPrograms.push(...dayPrograms);
    }
  }

  return allPrograms;
}

/**
 * Zwraca programy dla konkretnego kanału i dnia.
 */
export function getProgramsForChannelAndDay(
  allPrograms: Program[],
  channelId: string,
  date: Date
): Program[] {
  return allPrograms.filter(
    p => p.channelId === channelId && isSameDay(p.startTime, date)
  );
}

/**
 * Zwraca aktualnie emitowany program na danym kanale.
 */
export function getCurrentProgram(
  allPrograms: Program[],
  channelId: string,
  now: Date = new Date()
): Program | undefined {
  return allPrograms.find(
    p =>
      p.channelId === channelId &&
      p.startTime <= now &&
      p.endTime > now
  );
}

/**
 * Formatuje nazwę daty w języku polskim.
 */
export function formatPolishDate(date: Date): string {
  const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const today = new Date();
  const tomorrow = addDays(today, 1);

  if (isSameDay(date, today)) return `Dzisiaj, ${format(date, 'd')} ${months[date.getMonth()]}`;
  if (isSameDay(date, tomorrow)) return `Jutro, ${format(date, 'd')} ${months[date.getMonth()]}`;

  return `${days[date.getDay()]}, ${format(date, 'd')} ${months[date.getMonth()]}`;
}
